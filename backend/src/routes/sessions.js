import express from 'express';
import crypto from 'crypto';
import { google } from 'googleapis';
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
  attendeeEmails: session.attendeeEmails,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt
});

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

      return res.status(201).json({ session: toSessionResponse(updated || session) });
    }

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

      return res.status(201).json({
        session: toSessionResponse(updated || session),
        googleEvent: {
          id: response.data.id || null,
          htmlLink: response.data.htmlLink || null,
          meetUrl: googleMeetUrl
        }
      });
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

      return res.status(201).json({
        session: toSessionResponse(updated || session),
        warning: message
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to schedule session.';
    return res.status(500).json({ message });
  }
});

export default router;