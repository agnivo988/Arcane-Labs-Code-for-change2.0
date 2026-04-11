import express from 'express';
import crypto from 'crypto';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import ScheduledSession from '../models/ScheduledSession.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const normalizeEmailList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  }
  return String(value)
    .split(/[,\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const buildRtcJoinUrl = (sessionId) => {
  const template = process.env.RTC_JOIN_URL_TEMPLATE;
  if (template && template.includes('{sessionId}')) {
    return template.replaceAll('{sessionId}', sessionId);
  }

  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
  return `${frontendOrigin}/live?sessionId=${encodeURIComponent(sessionId)}`;
};

const createRtcSessionId = () => `rtc-${crypto.randomUUID()}`;

const getMailerTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
    auth: { user, pass }
  });
};

const getCalendarClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const auth = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
  );

  auth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: 'v3', auth });
};

const extractMeetUrl = (event) => {
  if (typeof event?.hangoutLink === 'string' && event.hangoutLink) return event.hangoutLink;
  const entries = event?.conferenceData?.entryPoints;
  if (Array.isArray(entries)) {
    const meetEntry = entries.find((entry) => entry?.entryPointType === 'video' && typeof entry?.uri === 'string');
    if (meetEntry?.uri) return meetEntry.uri;
  }
  return null;
};

const toSessionResponse = (session) => ({
  id: session._id.toString(),
  title: session.title,
  notes: session.notes,
  startsAt: session.startsAt,
  endsAt: session.endsAt,
  durationMinutes: session.durationMinutes,
  timeZone: session.timeZone,
  status: session.status,
  rtcProvider: session.rtcProvider,
  rtcSessionId: session.rtcSessionId,
  rtcJoinUrl: session.rtcJoinUrl,
  googleCalendarId: session.googleCalendarId,
  googleCalendarEventId: session.googleCalendarEventId,
  googleCalendarHtmlLink: session.googleCalendarHtmlLink,
  googleMeetUrl: session.googleMeetUrl,
  calendarSyncStatus: session.calendarSyncStatus,
  calendarSyncError: session.calendarSyncError,
  emailNotificationStatus: session.emailNotificationStatus,
  emailNotificationError: session.emailNotificationError,
  emailNotifiedAt: session.emailNotifiedAt,
  attendeeEmails: session.attendeeEmails,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt
});

const notifyAttendeesByEmail = async ({ session, organizerEmail }) => {
  if (!Array.isArray(session.attendeeEmails) || session.attendeeEmails.length === 0) {
    return { status: 'skipped', error: null, sentAt: null };
  }

  const transporter = getMailerTransport();
  if (!transporter) {
    return {
      status: 'not_configured',
      error: 'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.',
      sentAt: null
    };
  }

  const startsAt = new Date(session.startsAt);
  const endsAt = new Date(session.endsAt);
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
  const sessionPageUrl = `${frontendOrigin}/studio`;

  const lines = [
    `You have been invited to: ${session.title}`,
    '',
    `Start: ${startsAt.toISOString()}`,
    `End: ${endsAt.toISOString()}`,
    `Duration: ${session.durationMinutes} minutes`,
    '',
    `Primary live room (RTC): ${session.rtcJoinUrl || sessionPageUrl}`,
    `RTC Session ID: ${session.rtcSessionId}`,
    `Google Meet fallback: ${session.googleMeetUrl || 'Not available yet'}`,
    '',
    session.notes ? `Notes: ${session.notes}` : '',
    `Organizer: ${organizerEmail || 'Arcane Engine'}`
  ].filter(Boolean);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2 style="margin-bottom: 8px;">${session.title}</h2>
      <p style="margin: 4px 0;"><strong>Start:</strong> ${startsAt.toLocaleString()}</p>
      <p style="margin: 4px 0;"><strong>End:</strong> ${endsAt.toLocaleString()}</p>
      <p style="margin: 4px 0;"><strong>Duration:</strong> ${session.durationMinutes} minutes</p>
      <p style="margin: 12px 0 4px;"><strong>Primary live room (RTC):</strong> <a href="${session.rtcJoinUrl || sessionPageUrl}">${session.rtcJoinUrl || sessionPageUrl}</a></p>
      <p style="margin: 4px 0;"><strong>RTC Session ID:</strong> ${session.rtcSessionId}</p>
      <p style="margin: 4px 0;"><strong>Google Meet fallback:</strong> ${session.googleMeetUrl ? `<a href="${session.googleMeetUrl}">${session.googleMeetUrl}</a>` : 'Not available yet'}</p>
      ${session.notes ? `<p style="margin: 12px 0 4px;"><strong>Notes:</strong> ${session.notes}</p>` : ''}
      <p style="margin: 12px 0 0; color: #475569;">Organizer: ${organizerEmail || 'Arcane Engine'}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: session.attendeeEmails.join(','),
      subject: `[Arcane Session] ${session.title}`,
      text: lines.join('\n'),
      html
    });

    return { status: 'sent', error: null, sentAt: new Date() };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Failed to send attendee emails.',
      sentAt: null
    };
  }
};

router.get('/', requireAuth, async (req, res) => {
  try {
    const sessions = await ScheduledSession.find({ ownerUserId: req.user.userId })
      .sort({ startsAt: -1, createdAt: -1 })
      .limit(50);

    res.json({ sessions: sessions.map(toSessionResponse) });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to load scheduled sessions.' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const startsAtRaw = String(req.body?.startsAt || '').trim();
    const durationMinutes = Math.max(15, Math.min(480, Number(req.body?.durationMinutes || 30)));
    const attendeeEmails = normalizeEmailList(req.body?.attendeeEmails);
    const timeZone = String(req.body?.timeZone || process.env.DEFAULT_TIME_ZONE || 'UTC').trim() || 'UTC';

    if (!title) {
      return res.status(400).json({ message: 'Session title is required.' });
    }

    const startsAt = new Date(startsAtRaw);
    if (!startsAtRaw || Number.isNaN(startsAt.getTime())) {
      return res.status(400).json({ message: 'A valid start time is required.' });
    }

    if (startsAt.getTime() < Date.now() - 5 * 60 * 1000) {
      return res.status(400).json({ message: 'Start time must be in the future.' });
    }

    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
    const rtcSessionId = createRtcSessionId();
    const rtcJoinUrl = buildRtcJoinUrl(rtcSessionId);

    const session = await ScheduledSession.create({
      ownerUserId: req.user.userId,
      title,
      notes,
      startsAt,
      endsAt,
      durationMinutes,
      timeZone,
      rtcProvider: process.env.RTC_PROVIDER_NAME || 'custom',
      rtcSessionId,
      rtcJoinUrl,
      attendeeEmails
    });

    let persistedSession = session;

    const calendar = getCalendarClient();
    if (!calendar) {
      const updated = await ScheduledSession.findByIdAndUpdate(
        session._id,
        {
          $set: {
            calendarSyncStatus: 'not_configured',
            calendarSyncError: 'Google Calendar credentials are not configured.'
          }
        },
        { new: true }
      );
      persistedSession = updated || session;
    } else {
      try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        const requestId = `arcane-${rtcSessionId}`;
        const event = {
          summary: title,
          description: notes,
          start: { dateTime: startsAt.toISOString(), timeZone },
          end: { dateTime: endsAt.toISOString(), timeZone },
          attendees: attendeeEmails.map((email) => ({ email })),
          conferenceData: {
            createRequest: {
              requestId,
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          }
        };

        const response = await calendar.events.insert({
          calendarId,
          requestBody: event,
          conferenceDataVersion: 1,
          sendUpdates: attendeeEmails.length ? 'all' : 'none'
        });

        const googleMeetUrl = extractMeetUrl(response.data);
        const updated = await ScheduledSession.findByIdAndUpdate(
          session._id,
          {
            $set: {
              googleCalendarId: calendarId,
              googleCalendarEventId: response.data.id || null,
              googleCalendarHtmlLink: response.data.htmlLink || null,
              googleMeetUrl,
              calendarSyncStatus: 'synced',
              calendarSyncError: null
            }
          },
          { new: true }
        );

        persistedSession = updated || session;
      } catch (calendarError) {
        const message = calendarError instanceof Error ? calendarError.message : 'Failed to create Google Meet link.';
        const updated = await ScheduledSession.findByIdAndUpdate(
          session._id,
          {
            $set: {
              calendarSyncStatus: 'failed',
              calendarSyncError: message
            }
          },
          { new: true }
        );

        persistedSession = updated || session;
      }
    }

    const mailResult = await notifyAttendeesByEmail({
      session: persistedSession,
      organizerEmail: typeof req.user?.email === 'string' ? req.user.email : null
    });

    const updated = await ScheduledSession.findByIdAndUpdate(
      persistedSession._id,
      {
        $set: {
          emailNotificationStatus: mailResult.status,
          emailNotificationError: mailResult.error,
          emailNotifiedAt: mailResult.sentAt
        }
      },
      { new: true }
    );

    const responsePayload = {
      session: toSessionResponse(updated || persistedSession)
    };

    if (mailResult.error) {
      responsePayload.warning = mailResult.error;
    }

    return res.status(201).json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to schedule session.';
    return res.status(500).json({ message });
  }
});

export default router;