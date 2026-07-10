-- SCRUM-57: Extend schema for cancellation & refund tracking
-- Adds per-payment cancellation fee, refund status, and patient refund bank details.
-- Note: cancelled_by and cancel_reason already exist on the appointments table.
-- Idempotent (IF NOT EXISTS) so it is safe to re-run.

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "cancellation_fee" integer;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_status" varchar(20);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_bank_name" varchar(255);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_account_number" varchar(50);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_branch" varchar(255);
