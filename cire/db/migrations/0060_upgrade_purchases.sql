-- Self-serve upgrade purchases: a host buys a `wedding_entitlements`
-- capability (`vendors` or `registry`) instead of waiting for an operator to
-- run scripts/grant-entitlement.ts.
--
--  * `wedding_upgrade_purchases` — the money side of `wedding_entitlements`,
--    which cannot hold it: that table is keyed (wedding_id, entitlement) and
--    grants are `onConflictDoNothing`, so a second purchase of a key already
--    held would vanish with no record that money moved.
--    `checkout_session_id` is UNIQUE and NULLABLE — the row is written before
--    Stripe is told anything, exactly as `registry_contributions` is, so an
--    attempt that never reached Stripe is an orphan on our side where it can
--    be seen and closed.
--    `wedding_upgrade_purchases_one_pending_uniq` is PARTIAL: at most one
--    attempt in flight per (wedding, entitlement). The service resolves an
--    existing pending row before it ever reaches an insert; this is the
--    backstop for the race that lookup cannot close, not the control flow.
--  * `platform_sales` — the sales record, deliberately OUTSIDE the wedding
--    cascade: no foreign key, no wedding id, no profile id. cire is the
--    merchant of record for an upgrade, unlike a gift (a direct charge on the
--    couple's own connected account), so the record of money cire took must
--    not die with the wedding row. Written at settle, not at deletion, because
--    there is no wedding-DELETE flow to trigger it.
--    `purchase_id` is UNIQUE with no FK: after a future cascade it is an
--    orphan opaque string, and it is what makes the insert idempotent when
--    Stripe redelivers. It adds no linkability the shared timestamp does not
--    already give — this row is pseudonymous, not anonymous.

CREATE TABLE `platform_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_id` text NOT NULL,
	`entitlement` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`settled_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_sales_purchase_id_unique` ON `platform_sales` (`purchase_id`);--> statement-breakpoint
CREATE TABLE `wedding_upgrade_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`wedding_id` text NOT NULL,
	`entitlement` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`checkout_session_id` text,
	`payment_intent_id` text,
	`amount_minor` integer,
	`currency` text,
	`created_by_osn_profile_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`wedding_id`) REFERENCES `weddings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wedding_upgrade_purchases_checkout_session_id_unique` ON `wedding_upgrade_purchases` (`checkout_session_id`);--> statement-breakpoint
CREATE INDEX `wedding_upgrade_purchases_wedding_entitlement_idx` ON `wedding_upgrade_purchases` (`wedding_id`,`entitlement`);--> statement-breakpoint
CREATE INDEX `wedding_upgrade_purchases_payment_intent_idx` ON `wedding_upgrade_purchases` (`payment_intent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wedding_upgrade_purchases_one_pending_uniq` ON `wedding_upgrade_purchases` (`wedding_id`,`entitlement`) WHERE status = 'pending';