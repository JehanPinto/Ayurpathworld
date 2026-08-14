import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error("🔴 CRITICAL: RESEND_API_KEY is missing in .env file! Email service cannot start.");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const defaultFromEmail = "AyurPath Admin <no-reply@dev.ayurpath.world>";