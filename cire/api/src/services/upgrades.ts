/**
 * Buying a capability.
 *
 * Everything below exists to stop one of two failures, both of which are
 * invisible in a happy-path test and expensive in production:
 *
 *  - **Charging twice for one entitlement.** A webhook can lag — seconds
 *    normally, days if the Worker answered 500 and Stripe is retrying. An
 *    organiser who paid, saw nothing unlock, and pressed Upgrade again must not
 *    be handed a second payment page.
 *  - **Taking money and granting nothing.** The settle path is four separate D1
 *    round trips with no transaction (D1's only atomic primitive is `batch()`),
 *    so every step has to be individually idempotent and ordered so that a
 *    crash between any two is healed by Stripe's next delivery rather than
 *    frozen by it.
 *
 * The orderings here are load-bearing. See the comments at each one.
 */

import { platformSales, weddingUpgradePurchases } from "@cire/db";
import { and, eq, isNull } from "drizzle-orm";
import { Data, Effect } from "effect";

import { type Db, DbService, dbQuery } from "../db";
import { metricUpgradeCheckoutStarted, metricUpgradePurchaseSettled } from "../metrics";
import { entitlementService } from "./entitlements";
import type { StripeClient } from "./stripe";
import type { PurchasableEntitlement, UpgradeCatalogue } from "./upgrade-catalogue";

/** A purchase attempt that cannot proceed, and why. */
export class UpgradeConflict extends Data.TaggedError("UpgradeConflict")<{
  /**
   * `already_held` — nothing to sell. `processing` — an attempt is live or paid
   * but not yet settled, so the answer is "wait and poll", never "pay again".
   */
  readonly reason: "already_held" | "processing";
}> {}

/** The upgrade could not be sold here: no Stripe Price is configured for it. */
export class UpgradeUnavailable extends Data.TaggedError("UpgradeUnavailable")<{
  readonly entitlement: string;
}> {}

/** A write that failed for a reason that is not a conflict. */
export class UpgradeWriteError extends Data.TaggedError("UpgradeWriteError")<{
  readonly op: string;
  readonly reason: string;
}> {}

/** Stripe refused, so there is no payment page to send anyone to. */
export class UpgradeProviderError extends Data.TaggedError("UpgradeProviderError")<{
  readonly reason: string;
}> {}

/**
 * Tell a unique-constraint violation from any other write failure.
 *
 * A violation only ever reaches the error channel as a MESSAGE — both
 * bun:sqlite and D1 carry "UNIQUE constraint failed" — so the sniff is the only
 * way to distinguish it, and it must be narrow: a conflict on
 * `checkout_session_id` is a different situation from one on the partial
 * one-pending index, and anything that is not a conflict at all must surface as
 * a write error rather than a cheerful 409.
 */
export function upgradeConflictReason(message: string): "processing" | "session_taken" | null {
  if (!message.includes("UNIQUE constraint failed")) return null;
  if (message.includes("one_pending")) return "processing";
  if (message.includes("checkout_session_id")) return "session_taken";
  return null;
}

/**
 * How long a purchase row may sit with no Stripe session before another request
 * is allowed to close it.
 *
 * The window exists because a row is session-less for one Stripe round trip —
 * up to `STRIPE_CALL_TIMEOUT`, ten seconds — and closing another request's
 * in-flight row inside that window is a race: the first request then writes its
 * session id onto a closed row and hands the organiser a payment page whose
 * payment settles into a `failed` purchase. Nothing else in this repository
 * closes a row it does not own, and this is the condition under which it is
 * safe to.
 */
export const STALE_PENDING_MS = 60_000;

export interface StartPurchaseInput {
  weddingId: string;
  entitlement: PurchasableEntitlement;
  /** The owner who pressed Upgrade. Recorded, and used as the grant's actor. */
  actorProfileId: string;
  /**
   * Built from the purchase id, which does not exist until this call mints it —
   * so the caller hands over the shape of the URL rather than the URL. A plain
   * string here is how a `PURCHASE_ID` placeholder reaches Stripe and the
   * organiser returns to a page that cannot tell which purchase to poll.
   */
  successUrlFor: (purchaseId: string) => string;
  cancelUrl: string;
}

export interface StartPurchaseResult {
  purchaseId: string;
  url: string;
  /** True when this handed back a payment page that already existed. */
  reused: boolean;
}

type StartError = UpgradeConflict | UpgradeUnavailable | UpgradeWriteError | UpgradeProviderError;

export interface SettleInput {
  purchaseId: string;
  checkoutSessionId: string;
  paid: boolean;
  paidAmountMinor: number | null;
  paidCurrency: string | null;
  paymentIntentId: string | null;
}

/** What a settle attempt concluded. Mirrors the metric's bounded outcome set. */
export type SettleOutcome = "granted" | "replayed" | "unpaid" | "unknown";

export interface UpgradeServiceDeps {
  stripe: StripeClient;
  catalogue: UpgradeCatalogue;
  /** Injected so the staleness window is testable without waiting. */
  now?: () => number;
  newId?: (prefix: string) => string;
}

export function createUpgradeService(deps: UpgradeServiceDeps) {
  const now = deps.now ?? (() => Date.now());
  const newId = deps.newId ?? ((prefix: string) => `${prefix}_${crypto.randomUUID()}`);

  /** The wedding's live attempt at this key, if it has one. */
  const pendingFor = (db: Db, weddingId: string, entitlement: PurchasableEntitlement) =>
    dbQuery(() =>
      db
        .select({
          id: weddingUpgradePurchases.id,
          sessionId: weddingUpgradePurchases.checkoutSessionId,
          createdAt: weddingUpgradePurchases.createdAt,
        })
        .from(weddingUpgradePurchases)
        .where(
          and(
            eq(weddingUpgradePurchases.weddingId, weddingId),
            eq(weddingUpgradePurchases.entitlement, entitlement),
            eq(weddingUpgradePurchases.status, "pending"),
          ),
        )
        .all(),
    ).pipe(Effect.map((rows) => rows[0] ?? null));

  /**
   * Close a pending row, guarded on the exact state it was observed in.
   *
   * The guard is what makes this safe to call on a row another request may own:
   * if that request has moved the row on since it was read, zero rows change
   * and nothing is stolen.
   */
  const closePending = (
    db: Db,
    purchaseId: string,
    expect: { sessionId: string } | { sessionId: null },
    status: "expired" | "failed",
  ) =>
    dbQuery(() =>
      db
        .update(weddingUpgradePurchases)
        .set({ status, updatedAt: new Date(now()) })
        .where(
          and(
            eq(weddingUpgradePurchases.id, purchaseId),
            eq(weddingUpgradePurchases.status, "pending"),
            expect.sessionId === null
              ? isNull(weddingUpgradePurchases.checkoutSessionId)
              : eq(weddingUpgradePurchases.checkoutSessionId, expect.sessionId),
          ),
        )
        .run(),
    );

  return {
    /**
     * Start (or resume) a purchase.
     *
     * The step order is the double-charge defence and is not rearrangeable.
     */
    startPurchase(
      input: StartPurchaseInput,
    ): Effect.Effect<StartPurchaseResult, StartError, DbService> {
      return Effect.gen(function* () {
        const db = yield* DbService;

        // 1. Nothing to sell if the wedding already has it.
        if (yield* entitlementService.has(input.weddingId, input.entitlement)) {
          metricUpgradeCheckoutStarted(input.entitlement, "already_held");
          return yield* Effect.fail(new UpgradeConflict({ reason: "already_held" }));
        }

        const priceId = deps.catalogue.priceIdFor(input.entitlement);
        if (priceId === null) {
          metricUpgradeCheckoutStarted(input.entitlement, "unconfigured");
          return yield* Effect.fail(new UpgradeUnavailable({ entitlement: input.entitlement }));
        }

        // 2. Resolve any live attempt BEFORE inserting. The partial unique
        //    index is the backstop behind this, not the control flow.
        const existing = yield* pendingFor(db, input.weddingId, input.entitlement);
        if (existing !== null) {
          if (existing.sessionId !== null) {
            const probe = yield* deps.stripe
              .retrievePlatformCheckoutSession(existing.sessionId)
              .pipe(
                Effect.catch((e: unknown) =>
                  // A probe we could not run is not evidence the session is
                  // dead. Answering "processing" makes the organiser wait and
                  // retry; answering "expired" would mint a second payment page
                  // for a session that may well be open.
                  Effect.logError("upgrade session probe failed", {
                    purchaseId: existing.id,
                    reason: String(e),
                  }).pipe(Effect.as({ status: "unknown" as const })),
                ),
              );

            if (probe.status === "open") {
              metricUpgradeCheckoutStarted(input.entitlement, "reused");
              return { purchaseId: existing.id, url: probe.url, reused: true };
            }
            if (probe.status === "complete" || probe.status === "unknown") {
              // THE DOUBLE-CHARGE GUARD. A complete session means the money has
              // very likely moved and the webhook is merely late. Treating it as
              // dead — which a nullable probe result would force — closes a row
              // that was paid and sells the same entitlement again.
              metricUpgradeCheckoutStarted(input.entitlement, "processing");
              return yield* Effect.fail(new UpgradeConflict({ reason: "processing" }));
            }
            // Only `expired` is safe to replace.
            yield* closePending(db, existing.id, { sessionId: existing.sessionId }, "expired");
          } else {
            // Session-less: either another request's in-flight attempt, or one
            // whose Stripe call died. Age is the only thing that tells them
            // apart, so inside the window this waits rather than stealing.
            const age = now() - existing.createdAt.getTime();
            if (age < STALE_PENDING_MS) {
              metricUpgradeCheckoutStarted(input.entitlement, "processing");
              return yield* Effect.fail(new UpgradeConflict({ reason: "processing" }));
            }
            yield* closePending(db, existing.id, { sessionId: null }, "failed");
          }
        }

        // 3. Insert through tryPromise, not dbQuery: a partial-index conflict
        //    must land in the error channel as a 409, not as a defect (a 500).
        const purchaseId = newId("upg");
        const createdAt = new Date(now());
        yield* Effect.tryPromise({
          try: () =>
            Promise.resolve(
              db
                .insert(weddingUpgradePurchases)
                .values({
                  id: purchaseId,
                  weddingId: input.weddingId,
                  entitlement: input.entitlement,
                  status: "pending",
                  createdByOsnProfileId: input.actorProfileId,
                  createdAt,
                  updatedAt: createdAt,
                })
                .run(),
            ),
          catch: (e) => {
            const message = String(e);
            const reason = upgradeConflictReason(message);
            // Lost the race to another press: somebody else's attempt is live.
            return reason === "processing"
              ? new UpgradeConflict({ reason: "processing" })
              : new UpgradeWriteError({ op: "insert-purchase", reason: message });
          },
        });

        // 4. Mint the session. On failure close our own row in the same request
        //    so the next press is not made to wait out the staleness window.
        const session = yield* deps.stripe
          .createPlatformCheckoutSession({
            priceId,
            successUrl: input.successUrlFor(purchaseId),
            cancelUrl: input.cancelUrl,
            clientReferenceId: purchaseId,
            metadata: { purchaseId },
            idempotencyKey: `cire-upgrade-${purchaseId}`,
          })
          .pipe(
            Effect.tapError(() => closePending(db, purchaseId, { sessionId: null }, "failed")),
            Effect.mapError((e) => new UpgradeProviderError({ reason: String(e) })),
          );

        // 5. Store the session id CONDITIONALLY and check the row count. Zero
        //    rows means somebody closed or claimed this row while Stripe was
        //    thinking, and handing out its URL would take a payment into a row
        //    that can never settle.
        const attached = yield* dbQuery(() =>
          db
            .update(weddingUpgradePurchases)
            .set({ checkoutSessionId: session.id, updatedAt: new Date(now()) })
            .where(
              and(
                eq(weddingUpgradePurchases.id, purchaseId),
                eq(weddingUpgradePurchases.status, "pending"),
                isNull(weddingUpgradePurchases.checkoutSessionId),
              ),
            )
            .run(),
        );
        if (rowsChanged(attached) === 0) {
          metricUpgradeCheckoutStarted(input.entitlement, "processing");
          return yield* Effect.fail(new UpgradeConflict({ reason: "processing" }));
        }

        metricUpgradeCheckoutStarted(input.entitlement, "ok");
        return { purchaseId, url: session.url, reused: false };
      }).pipe(Effect.withSpan("cire.upgrade.startPurchase"));
    },

    /**
     * Settle a purchase from a verified webhook delivery. The ONLY place an
     * entitlement is granted from a payment.
     *
     * ORDER: verify → paid? → grant → sales → flip.
     *
     * THE INVARIANT, which matters more than the order: every delivery for a
     * paid session re-runs the grant and the sales insert, both idempotent, and
     * NOTHING short-circuits on "this row already reads succeeded". That state
     * is exactly what a delivery dying between the flip and the grant leaves
     * behind, so treating it as nothing-to-do would strand a customer who paid
     * with no entitlement and no further chance to get one.
     *
     * The order then makes the window as small as it can be — a crash after the
     * flip has nothing left to lose, and the conditional UPDATE is only ever
     * reporting whether THIS delivery was the first, never gating the work.
     */
    settlePurchase(input: SettleInput): Effect.Effect<SettleOutcome, never, DbService> {
      return Effect.gen(function* () {
        const db = yield* DbService;
        const rows = yield* dbQuery(() =>
          db
            .select({
              id: weddingUpgradePurchases.id,
              weddingId: weddingUpgradePurchases.weddingId,
              entitlement: weddingUpgradePurchases.entitlement,
              status: weddingUpgradePurchases.status,
              sessionId: weddingUpgradePurchases.checkoutSessionId,
              buyer: weddingUpgradePurchases.createdByOsnProfileId,
            })
            .from(weddingUpgradePurchases)
            .where(eq(weddingUpgradePurchases.id, input.purchaseId))
            .all(),
        );
        const row = rows[0];
        if (row === undefined) {
          // Not ours. The platform endpoint is shared with whatever else this
          // Stripe account does, so this is an ordinary outcome, not an error.
          yield* Effect.logWarning("upgrade settle for an unknown purchase", {
            purchaseId: input.purchaseId,
          });
          return "unknown";
        }

        // A NULL session id is ADOPTION, not a mismatch: the row is
        // session-less for the window between minting the session and storing
        // its id, and the session is payable throughout. Rejecting it would
        // lock out a customer who paid.
        if (row.sessionId !== null && row.sessionId !== input.checkoutSessionId) {
          yield* Effect.logError("upgrade settle session mismatch", {
            purchaseId: input.purchaseId,
            heldSessionId: row.sessionId,
          });
          return "unknown";
        }

        const entitlement = row.entitlement as PurchasableEntitlement;

        if (!input.paid) {
          // Card-only sessions cannot complete unpaid, so this should never
          // fire — but granting on an unpaid session is the one mistake that
          // cannot be undone by a retry, so the check stays.
          metricUpgradePurchaseSettled(entitlement, "unpaid");
          return "unpaid";
        }

        // GRANT FIRST. Idempotent on its own primary key.
        yield* entitlementService.grant(row.weddingId, entitlement, {
          source: "purchase",
          // A webhook has no actor of its own; the buyer is the honest answer
          // and is what the audit column is for.
          grantedBy: row.buyer,
          providerRef: input.checkoutSessionId,
        });

        // SALES SECOND, keyed on the purchase so a redelivery writes one row.
        yield* dbQuery(() =>
          db
            .insert(platformSales)
            .values({
              id: newId("sal"),
              purchaseId: row.id,
              entitlement,
              amountMinor: input.paidAmountMinor ?? 0,
              currency: input.paidCurrency?.toUpperCase() ?? "",
              settledAt: new Date(now()),
            })
            .onConflictDoNothing()
            .run(),
        );

        // FLIP LAST, conditionally. Zero rows means a previous delivery already
        // did all of the above.
        const flipped = yield* dbQuery(() =>
          db
            .update(weddingUpgradePurchases)
            .set({
              status: "succeeded",
              checkoutSessionId: input.checkoutSessionId,
              paymentIntentId: input.paymentIntentId,
              amountMinor: input.paidAmountMinor,
              currency: input.paidCurrency?.toUpperCase() ?? null,
              updatedAt: new Date(now()),
            })
            .where(
              and(
                eq(weddingUpgradePurchases.id, row.id),
                eq(weddingUpgradePurchases.status, "pending"),
              ),
            )
            .run(),
        );

        const outcome: SettleOutcome = rowsChanged(flipped) === 0 ? "replayed" : "granted";
        metricUpgradePurchaseSettled(entitlement, outcome === "granted" ? "granted" : "replayed");
        return outcome;
      }).pipe(Effect.withSpan("cire.upgrade.settlePurchase"));
    },

    /** Close a purchase Stripe says is over. Only ever moves a `pending` row. */
    failPurchase(input: {
      purchaseId: string;
      checkoutSessionId: string;
      status: "failed" | "expired";
    }): Effect.Effect<"closed" | "ignored", never, DbService> {
      return Effect.gen(function* () {
        const db = yield* DbService;
        const changed = yield* dbQuery(() =>
          db
            .update(weddingUpgradePurchases)
            .set({ status: input.status, updatedAt: new Date(now()) })
            .where(
              and(
                eq(weddingUpgradePurchases.id, input.purchaseId),
                eq(weddingUpgradePurchases.status, "pending"),
                eq(weddingUpgradePurchases.checkoutSessionId, input.checkoutSessionId),
              ),
            )
            .run(),
        );
        if (rowsChanged(changed) === 0) return "ignored";
        const rows = yield* dbQuery(() =>
          db
            .select({ entitlement: weddingUpgradePurchases.entitlement })
            .from(weddingUpgradePurchases)
            .where(eq(weddingUpgradePurchases.id, input.purchaseId))
            .all(),
        );
        const entitlement = rows[0]?.entitlement as PurchasableEntitlement | undefined;
        if (entitlement) {
          metricUpgradePurchaseSettled(
            entitlement,
            input.status === "failed" ? "failed" : "expired",
          );
        }
        return "closed";
      }).pipe(Effect.withSpan("cire.upgrade.failPurchase"));
    },

    /**
     * A purchase's state, for the page the organiser returns to. Scoped to the
     * wedding, so an id belonging to another wedding is simply not found.
     */
    purchaseStatus(
      weddingId: string,
      purchaseId: string,
    ): Effect.Effect<{ status: string; entitlement: string } | null, never, DbService> {
      return Effect.gen(function* () {
        const db = yield* DbService;
        const rows = yield* dbQuery(() =>
          db
            .select({
              status: weddingUpgradePurchases.status,
              entitlement: weddingUpgradePurchases.entitlement,
            })
            .from(weddingUpgradePurchases)
            .where(
              and(
                eq(weddingUpgradePurchases.id, purchaseId),
                eq(weddingUpgradePurchases.weddingId, weddingId),
              ),
            )
            .all(),
        );
        return rows[0] ?? null;
      }).pipe(Effect.withSpan("cire.upgrade.purchaseStatus"));
    },
  };
}

/**
 * Rows a write touched, across both drivers.
 *
 * bun:sqlite returns `{ changes }`; D1 reports it under `meta.changes`. The
 * conditional writes above are guards, and a guard whose row count cannot be
 * read is not a guard — so an unreadable shape counts as zero, which fails
 * closed (the caller treats it as "somebody else got there first").
 */
function rowsChanged(result: unknown): number {
  const direct = (result as { changes?: unknown })?.changes;
  if (typeof direct === "number") return direct;
  const meta = (result as { meta?: { changes?: unknown } })?.meta?.changes;
  return typeof meta === "number" ? meta : 0;
}

export type UpgradeService = ReturnType<typeof createUpgradeService>;
