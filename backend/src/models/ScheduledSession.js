import mongoose from 'mongoose';

const scheduledSessionSchema = new mongoose.Schema(
  {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: '', trim: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 15, max: 480 },
    timeZone: { type: String, default: 'UTC' },
    status: { type: String, enum: ['scheduled', 'live', 'completed', 'cancelled'], default: 'scheduled' },
    rtcProvider: { type: String, default: 'custom' },
    rtcSessionId: { type: String, required: true, unique: true, index: true },
    rtcJoinUrl: { type: String, default: null },
    googleCalendarId: { type: String, default: null },
    googleCalendarEventId: { type: String, default: null },
    googleCalendarHtmlLink: { type: String, default: null },
    googleMeetUrl: { type: String, default: null },
    calendarSyncStatus: { type: String, enum: ['pending', 'synced', 'not_configured', 'failed'], default: 'pending' },
    calendarSyncError: { type: String, default: null },
    attendeeEmails: { type: [String], default: [] }
  },
  { timestamps: true }
);

scheduledSessionSchema.index({ ownerUserId: 1, startsAt: -1 });

export default mongoose.models.ScheduledSession || mongoose.model('ScheduledSession', scheduledSessionSchema);