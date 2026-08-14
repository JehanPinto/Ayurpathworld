import { resend, defaultFromEmail } from "./config"; 
import { 
  getPasswordResetOtpEmailHtml, 
  getPatientBookingReceiptEmailHtml, 
  getDoctorNewBookingEmailHtml, 
  getDoctorVerifiedEmailHtml,
  getRegistrationOtpEmailHtml
 } from "./templates";

export async function sendPasswordResetOtpEmail(toEmail: string, otp: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: defaultFromEmail,
      to: toEmail,
      subject: 'Your Password Reset Verification Code - AyurPath',
      html: getPasswordResetOtpEmailHtml(otp)
    });

    if (error) {
      console.error("🔴 Resend Error (OTP):", error);
      return { success: false, error: "Failed to send email" };
    }
    return { success: true };
    
  } catch (err) {
    console.error("🔴 Server Error (OTP):", err);
    return { success: false, error: "Server Error" };
  }
}

export async function sendPatientBookingReceiptEmail(
  toEmail: string,
  patientName: string,
  doctorName: string,
  date: string,
  time: string,
  amount: number,
  consultationType: string,
  meetLink: string,
  paymentMethod: string
) {
  try {
    console.log(`[EMAIL] Attempting to send Patient Receipt to: ${toEmail}`);
    const { data, error } = await resend.emails.send({
      from: defaultFromEmail,
      to: [toEmail],
      subject: `Booking Confirmed with Dr. ${doctorName} - AyurPath`,
      html: getPatientBookingReceiptEmailHtml(patientName, doctorName, date, time, amount, consultationType, meetLink, paymentMethod),
    });
    
    if (error) {
      console.error(`🔴 Failed to send patient receipt email to ${toEmail}:`, error);
      return { success: false, error: error.message };
    }
    
    console.log(`🟢 Patient Receipt email sent to ${toEmail} | ID: ${data?.id}`);
    return { success: true };
  } catch (err) {
    console.error("🔴 Failed to send patient receipt email:", err);
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendDoctorNewBookingEmail(
  toEmail: string,
  doctorName: string,
  patientName: string,
  symptoms: string,
  date: string,
  time: string,
  consultationType: string,
  meetLink: string
) {
  try {
    console.log(`[EMAIL] Attempting to send Doctor Notification to: ${toEmail}`);
    const { data, error } = await resend.emails.send({
      from: defaultFromEmail,
      to: [toEmail],
      subject: `New Appointment: ${patientName} on ${date}`,
      html: getDoctorNewBookingEmailHtml(doctorName, patientName, symptoms, date, time, consultationType, meetLink),
    });

    if (error) {
      console.error(`🔴 Failed to send doctor notification email to ${toEmail}:`, error);
      return { success: false, error: error.message };
    }
    
    console.log(`🟢 Doctor notification email sent to ${toEmail} | ID: ${data?.id}`);
    return { success: true };
  } catch (err) {
    console.error("🔴 Failed to send doctor notification email:", err);
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendDoctorVerifiedEmail(toEmail: string, doctorName: string) {
  try {
    console.log(`[EMAIL] Attempting to send Doctor Verification to: ${toEmail}`);
    const { data, error } = await resend.emails.send({
      from: defaultFromEmail,
      to: [toEmail],
      subject: `Your AyurPath Doctor Account is Verified!`,
      html: getDoctorVerifiedEmailHtml(doctorName),
    });

    if (error) {
      console.error(`🔴 Failed to send verification email to ${toEmail}:`, error);
      return { success: false, error: error.message };
    }
    
    console.log(`🟢 Verification email sent to ${toEmail} | ID: ${data?.id}`);
    return { success: true };
  } catch (err) {
    console.error("🔴 Failed to send verification email:", err);
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendRegistrationOtpEmail(toEmail: string, otp: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: defaultFromEmail,
      to: toEmail,
      subject: 'Verify your email address - AyurPath',
      html: getRegistrationOtpEmailHtml(otp)
    });

    if (error) {
      console.error("🔴 Resend Error (Reg OTP):", error);
      return { success: false, error: "Failed to send verification email" };
    }
    return { success: true };
    
  } catch (err) {
    console.error("🔴 Server Error (Reg OTP):", err);
    return { success: false, error: "Server Error" };
  }
}