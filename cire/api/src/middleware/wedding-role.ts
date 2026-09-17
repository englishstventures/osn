import type { HostRole } from "../services/hosts";

/** The caller's effective role on a wedding: its owner, or the app-layer role
 *  of their `wedding_hosts` seat. */
export type WeddingRole = "owner" | HostRole;

/**
 * What a gate asks about — one name per gate, not per route. `member` is the
 * read surface (`weddingMember()`), `editor` the module writes
 * (`weddingEditor()`), `runSheet` the day-of run sheet (`weddingRunSheet()`).
 * The owner-only surface has no capability: `weddingOwner()` compares ids and
 * never consults a role.
 */
export type WeddingCapability = "member" | "editor" | "runSheet";

type RolePolicy = {
  capabilities: readonly WeddingCapability[];
  /**
   * The error string a refusal of THIS role produces, at whichever gate
   * refuses it. `read_only_role` is a viewer's alone — the portal turns it into
   * "ask the owner for editor access", which is only true of someone who can
   * already see the wedding. Every other refusal is the same `forbidden` a
   * stranger gets and so discloses nothing about why.
   */
  refusal: "forbidden" | "read_only_role";
};

const DENY_ALL: RolePolicy = { capabilities: [], refusal: "forbidden" };

/**
 * The authorisation table, and the only place a role's reach is decided.
 *
 * The switch is exhaustive over {@link WeddingRole} and has no `default`, so a
 * role added to `wedding_hosts.role` widens `HostRole`, widens this union, and
 * fails the type check here until it has been given a policy. That is the
 * point: the previous shape — gates each excluding the roles they knew about —
 * admitted a new role everywhere by default, silently and with nothing red.
 *
 * A stored value outside the enum cannot reach this (`normaliseHostRole`
 * degrades it first), but if one ever did, the tail returns {@link DENY_ALL}
 * rather than throwing: a corrupted row must be a refusal, not a 500.
 */
export function policyFor(role: WeddingRole): RolePolicy {
  switch (role) {
    case "owner":
    case "editor":
      return { capabilities: ["member", "editor", "runSheet"], refusal: "forbidden" };
    case "viewer":
      return { capabilities: ["member", "runSheet"], refusal: "read_only_role" };
  }
  const _exhaustive: never = role;
  return DENY_ALL;
}

export type CapabilityDecision =
  | { allowed: true }
  | { allowed: false; error: "forbidden" | "read_only_role" };

/** May `role` exercise `capability`, and if not, what does the caller see? */
export function decideCapability(
  role: WeddingRole,
  capability: WeddingCapability,
): CapabilityDecision {
  const policy = policyFor(role);
  if (policy.capabilities.includes(capability)) return { allowed: true };
  return { allowed: false, error: policy.refusal };
}
