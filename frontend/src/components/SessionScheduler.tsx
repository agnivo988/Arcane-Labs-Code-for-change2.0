import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

interface ScheduledSession {
  id: string;
  title: string;
  notes: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  timeZone: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  rtcProvider: string;
  rtcSessionId: string;
  rtcJoinUrl: string | null;
  googleCalendarEventId: string | null;
  googleCalendarHtmlLink: string | null;
  googleMeetUrl: string | null;
  calendarSyncStatus: 'pending' | 'synced' | 'not_configured' | 'failed';
  calendarSyncError: string | null;
  attendeeEmails: string[];
  createdAt: string;
  updatedAt: string;
}

interface SessionSchedulerProps {
  authToken: string | null;
  onOpenRtcRoom: (session: ScheduledSession) => void;
}

const SESSION_STORAGE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const formatDateTimeLocal = (value: Date) => {
  const pad = (input: number) => String(input).padStart(2, '0');
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const SessionScheduler = ({ authToken, onOpenRtcRoom }: SessionSchedulerProps) => {
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    title: 'Arcane Live Session',
    notes: 'Use Google Meet for the invite and ARCANE live room for the main session.',
    startsAt: formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
    durationMinutes: 45,
    attendeeEmails: '',
    timeZone: SESSION_STORAGE_TZ
  }));

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime());
  }, [sessions]);

  const loadSessions = useCallback(async () => {
    if (!authToken) {
      setSessions([]);
      return;
    }

    setLoadingSessions(true);
    setError(null);
    try {
      const response = await fetch('/api/sessions', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load scheduled sessions.');
      }

      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load scheduled sessions.');
    } finally {
      setLoadingSessions(false);
    }
  }, [authToken]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const createSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authToken) {
      setError('Sign in to schedule a session.');
      return;
    }

    setCreatingSession(true);
    setError(null);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          title: form.title,
          notes: form.notes,
          startsAt: new Date(form.startsAt).toISOString(),
          durationMinutes: Number(form.durationMinutes),
          attendeeEmails: form.attendeeEmails,
          timeZone: form.timeZone
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to schedule session.');
      }

      const created = data?.session as ScheduledSession | undefined;
      if (created) {
        setSessions((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      }
      setForm((current) => ({
        ...current,
        title: 'Arcane Live Session',
        notes: 'Use Google Meet for the invite and ARCANE live room for the main session.',
        startsAt: formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
        durationMinutes: 45,
        attendeeEmails: ''
      }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to schedule session.');
    } finally {
      setCreatingSession(false);
    }
  };

  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/75">Scheduled Sessions</p>
          <h3 className="text-lg font-semibold mt-1">Google Meet handoff with RTC as the primary room</h3>
          <p className="text-sm text-slate-300 mt-1">
            Create a calendar invite, store the Meet URL for fallback access, and keep the RTC session ID ready for the live experience.
          </p>
        </div>
        <button className="arcane-btn arcane-btn-ghost" type="button" onClick={() => void loadSessions()} disabled={loadingSessions}>
          {loadingSessions ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {!authToken && (
        <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 mb-4">
          Sign in to create and sync scheduled sessions.
        </div>
      )}

      <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={createSession}>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm text-slate-200">Session title</span>
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            className="rounded-xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm outline-none focus:border-cyan-300/60"
            placeholder="Arcane Live Session"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-slate-200">Starts at</span>
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
            className="rounded-xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm outline-none focus:border-cyan-300/60"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-slate-200">Duration minutes</span>
          <input
            type="number"
            min={15}
            max={480}
            step={15}
            value={form.durationMinutes}
            onChange={(event) => setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}
            className="rounded-xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm outline-none focus:border-cyan-300/60"
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm text-slate-200">Attendee emails, one per line or comma-separated</span>
          <textarea
            value={form.attendeeEmails}
            onChange={(event) => setForm((current) => ({ ...current, attendeeEmails: event.target.value }))}
            rows={3}
            className="rounded-xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm outline-none focus:border-cyan-300/60 resize-none"
            placeholder="producer@studio.com, editor@studio.com"
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm text-slate-200">Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            rows={3}
            className="rounded-xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm outline-none focus:border-cyan-300/60 resize-none"
            placeholder="Add agenda notes, handoff details, or join instructions."
          />
        </label>

        {error && <p className="md:col-span-2 text-sm text-rose-300">{error}</p>}

        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">Meet links are created from Google Calendar when backend credentials are configured.</p>
          <button className="arcane-btn arcane-btn-primary" type="submit" disabled={creatingSession || !authToken}>
            {creatingSession ? 'Scheduling...' : 'Schedule Session'}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {sortedSessions.length === 0 ? (
          <p className="text-sm text-slate-300">No scheduled sessions yet.</p>
        ) : (
          sortedSessions.map((session) => (
            <article key={session.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-slate-100">{session.title}</h4>
                  <p className="text-sm text-slate-300">
                    {new Date(session.startsAt).toLocaleString()} · {session.durationMinutes} min · {session.timeZone}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em]">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">{session.status}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">{session.calendarSyncStatus}</span>
                </div>
              </div>

              {session.notes && <p className="text-sm text-slate-300">{session.notes}</p>}

              <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                <p><span className="text-slate-400">RTC Session:</span> {session.rtcSessionId}</p>
                <p><span className="text-slate-400">Provider:</span> {session.rtcProvider}</p>
                <p className="md:col-span-2">
                  <span className="text-slate-400">Meet:</span>{' '}
                  {session.googleMeetUrl ? (
                    <a className="text-cyan-200 hover:underline break-all" href={session.googleMeetUrl} target="_blank" rel="noreferrer">
                      {session.googleMeetUrl}
                    </a>
                  ) : (
                    <span className="text-amber-200">Not synced yet</span>
                  )}
                </p>
                {session.calendarSyncError && <p className="md:col-span-2 text-amber-200">{session.calendarSyncError}</p>}
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="arcane-btn arcane-btn-primary" type="button" onClick={() => onOpenRtcRoom(session)}>
                  Open RTC Room
                </button>
                {session.googleMeetUrl && (
                  <a className="arcane-btn arcane-btn-ghost" href={session.googleMeetUrl} target="_blank" rel="noreferrer">
                    Open Meet Link
                  </a>
                )}
                {session.googleCalendarHtmlLink && (
                  <a className="arcane-btn arcane-btn-ghost" href={session.googleCalendarHtmlLink} target="_blank" rel="noreferrer">
                    Open Calendar Event
                  </a>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
};

export default SessionScheduler;
