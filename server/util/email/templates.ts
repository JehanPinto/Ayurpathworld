export function sanitizeHTML(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const getApplicationEmailHtml = (
  applicantName: string,
  jobTitle: string,
  isAccepted: boolean,
  message: string
) => {
  const safeName = sanitizeHTML(applicantName);
  const safeTitle = sanitizeHTML(jobTitle);
  const safeMessage = sanitizeHTML(message);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: ${isAccepted ? "#2a9d5c" : "#d32f2f"}; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Application ${isAccepted ? "Accepted" : "Update"}</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
            <p style="font-size: 16px; color: #333;">Dear ${safeName},</p>
            <p style="font-size: 16px; color: #333; line-height: 1.5;">
                ${
                  isAccepted
                    ? `Congratulations! We are pleased to inform you that your application for the <strong>${safeTitle}</strong> position has been accepted for the next stage.`
                    : `Thank you for taking the time to apply for the <strong>${safeTitle}</strong> position. We appreciate your interest in joining our team.`
                }
            </p>
            <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid ${isAccepted ? "#2a9d5c" : "#666"}; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #333;">Message from Administration:</h3>
                <p style="margin-bottom: 0; color: #555; white-space: pre-wrap;">${safeMessage}</p>
            </div>
            ${
              !isAccepted
                ? `
            <p style="font-size: 16px; color: #333; line-height: 1.5;">
                While your qualifications are impressive, we have decided to move forward with other candidates at this time. We will keep your resume on file for future opportunities.
            </p>
            `
                : ""
            }
            <p style="font-size: 16px; color: #333; margin-top: 30px;">Best regards,<br><strong>AyurPath Administration Team</strong></p>
        </div>
    </div>
  `;
};

export const getPasswordResetOtpEmailHtml = (otp: string) => {
  const safeOtp = sanitizeHTML(otp); // Just in case
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #059669; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Password Reset Request</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff; text-align: center;">
            <p style="font-size: 16px; color: #333;">Hello,</p>
            <p style="font-size: 16px; color: #333; line-height: 1.5;">
                We received a request to reset the password for your AyurPath account. 
                Please use the verification code below to proceed:
            </p>
            <div style="margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #059669; background-color: #ecfdf5; padding: 15px 25px; border-radius: 8px; border: 2px dashed #34d399;">
                    ${safeOtp}
                </span>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 20px;">
                This code will expire in <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email or contact support.
            </p>
            <p style="font-size: 14px; color: #333; margin-top: 30px;">Best regards,<br><strong>AyurPath Security Team</strong></p>
        </div>
    </div>
  `;
};

export const getPatientBookingReceiptEmailHtml = (
  patientName: string,
  doctorName: string,
  date: string,
  time: string,
  amount: number,
  consultationType: string,
  meetLink: string,
  paymentMethod: string
) => {
  const safeName = sanitizeHTML(patientName);
  const isOnline = consultationType === "online";
  const formattedAmount = `LKR ${amount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #2563EB; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Booking Confirmed & Receipt</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
            <p style="font-size: 16px; color: #333;">Dear ${safeName},</p>
            <p style="font-size: 16px; color: #333;">Your appointment with <strong>Dr. ${doctorName}</strong> is confirmed. Below are your booking and payment details.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Date</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">${date}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Time</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">${time}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Consultation Type</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right; text-transform: capitalize;">${consultationType.replace('_', ' ')}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Payment Status</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: ${paymentMethod === 'online' ? '#059669' : '#d97706'}; text-align: right;">
                        ${paymentMethod === 'online' ? 'PAID' : 'PAY AT CLINIC'}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">Total Amount</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 18px; color: #2563EB; text-align: right;">${formattedAmount}</td>
                </tr>
            </table>

            ${isOnline && meetLink ? `
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
                <h3 style="color: #166534; margin-top: 0;">Your Google Meet Link</h3>
                <p style="color: #15803d; font-size: 14px; margin-bottom: 15px;">Please join the meeting 5 minutes before the scheduled time.</p>
                <a href="${meetLink}" style="background-color: #059669; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                    Join Consultation
                </a>
            </div>
            ` : ''}

            <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">Thank you for choosing AyurPath for your healthcare needs.</p>
        </div>
    </div>
  `;
};

export const getDoctorNewBookingEmailHtml = (
  doctorName: string,
  patientName: string,
  symptoms: string,
  date: string,
  time: string,
  consultationType: string,
  meetLink: string
) => {
  const isOnline = consultationType === "online";
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">New Appointment Received</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
            <p style="font-size: 16px; color: #333;">Hello Dr. ${doctorName},</p>
            <p style="font-size: 16px; color: #333;">A new consultation has been booked and confirmed by <strong>${patientName}</strong>.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #333;"><strong>Date:</strong> ${date}</p>
                <p style="margin: 0 0 10px 0; color: #333;"><strong>Time:</strong> ${time}</p>
                <p style="margin: 0 0 10px 0; color: #333; text-transform: capitalize;"><strong>Type:</strong> ${consultationType.replace('_', ' ')}</p>
            </div>

            <h3 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 5px;">Chief Complaint / Symptoms:</h3>
            <p style="color: #555; background-color: #fef2f2; padding: 15px; border-radius: 5px; font-style: italic;">
                "${sanitizeHTML(symptoms)}"
            </p>

            ${isOnline && meetLink ? `
            <div style="text-align: center; margin: 30px 0;">
                <p style="color: #64748b; font-size: 14px;">This is an online consultation. Here is the meeting link:</p>
                <a href="${meetLink}" style="background-color: #3b82f6; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                    Start Meeting
                </a>
            </div>
            ` : ''}

            <p style="font-size: 14px; color: #666; margin-top: 30px;">Please ensure you review the patient's history before the consultation starts.</p>
        </div>
    </div>
  `;
};