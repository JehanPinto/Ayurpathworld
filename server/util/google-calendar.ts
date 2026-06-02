import { google } from "googleapis";
import { randomUUID } from "crypto";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID_TEST,
  process.env.GOOGLE_CLIENT_SECRET_TEST,
  process.env.GOOGLE_REDIRECT_URL_TEST
);

if (process.env.GOOGLE_REFRESH_TOKEN_TEST) {
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN_TEST });
}

// patientEmail එක optional කරලා තියෙන්නේ (string | null)
export async function createGoogleMeetEvent(doctorEmail: string, patientEmail: string | null, startTimeIso: string) {
  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    const endTime = new Date(new Date(startTimeIso).getTime() + 30 * 60000).toISOString();

    // Attendees හදන විදිහ
    const attendees = [{ email: doctorEmail }];
    if (patientEmail) {
      attendees.push({ email: patientEmail });
    }

    const event = {
      summary: 'AyurPath Online Consultation',
      description: 'Your online Ayurvedic consultation is scheduled. Please join on time.',
      start: { dateTime: startTimeIso, timeZone: 'Asia/Colombo' },
      end: { dateTime: endTime, timeZone: 'Asia/Colombo' },
      conferenceData: {
        createRequest: { 
          requestId: `meet-${randomUUID()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" } 
        }
      },
      attendees: attendees, // වෙනස් කරපු තැන
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 }, 
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1, 
      sendUpdates: 'none' 
    });

    return {
      meetingLink: response.data.hangoutLink,
      meetingId: response.data.id
    };
  } catch (error) {
    console.error("❌ Failed to create Google Meet Event:", error);
    return null;
  }
}