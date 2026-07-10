-- Cancellation feature: per-doctor cancellation policy fields on doctor_profiles.
-- Fee charged to the patient for late cancellations (type = amount|percentage),
-- applied only when the patient cancels within cancellation_window_hours of the appointment.
-- Idempotent (IF NOT EXISTS) so it is safe to re-run.

ALTER TABLE "doctor_profiles" ADD COLUMN IF NOT EXISTS "cancellation_fee_enabled" boolean DEFAULT false;
ALTER TABLE "doctor_profiles" ADD COLUMN IF NOT EXISTS "cancellation_fee_type" varchar(20);
ALTER TABLE "doctor_profiles" ADD COLUMN IF NOT EXISTS "cancellation_fee_amount" integer DEFAULT 0;
ALTER TABLE "doctor_profiles" ADD COLUMN IF NOT EXISTS "cancellation_window_hours" integer;
