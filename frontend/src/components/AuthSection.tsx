import { useEffect, useMemo, useState } from 'react';

type Profile = {
  id: string;
  name: string;
  email: string;
  workspaceName?: string;
  plan?: string;
  status?: string;
  promptsGenerated?: number;
  imagesGenerated?: number;
  imagesEdited?: number;
  imagesFused?: number;
  lastLoginAt?: string | null;
  createdAt?: string;
};

type Mode = 'signup' | 'login';

const tokenKey = 'arcane-auth-token';

interface AuthSectionProps {
  defaultMode?: Mode;
  onSuccess?: () => void;
  compact?: boolean;
}

const AuthSection = ({ defaultMode = 'signup', onSuccess, compact = false }: AuthSectionProps) => {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: 'Main Studio' });

  const profileCards = useMemo(() => ([
    { label: 'Prompts', value: profile?.promptsGenerated ?? 0 },
    { label: 'Images', value: profile?.imagesGenerated ?? 0 },
    { label: 'Edits', value: profile?.imagesEdited ?? 0 },
    { label: 'Fusions', value: profile?.imagesFused ?? 0 }
  ]), [profile]);

  const loadProfile = async (authToken: string) => {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) throw new Error('Failed to load profile');
    const data = await response.json();
    setProfile(data.user);
  };

  useEffect(() => {
    if (!token) return;
    loadProfile(token).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load profile');
      setToken(null);
      localStorage.removeItem(tokenKey);
      window.dispatchEvent(new Event('arcane-auth-changed'));
    });
  }, [token]);

  useEffect(() => {
    const refreshProfile = () => {
      const authToken = localStorage.getItem(tokenKey);
      if (!authToken) return;
      loadProfile(authToken).catch(() => undefined);
    };

    window.addEventListener('arcane-profile-refresh', refreshProfile);
    window.addEventListener('storage', refreshProfile);

    return () => {
      window.removeEventListener('arcane-profile-refresh', refreshProfile);
      window.removeEventListener('storage', refreshProfile);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload = mode === 'signup'
        ? form
        : { email: form.email, password: form.password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      localStorage.setItem(tokenKey, data.token);
      setToken(data.token);
      setProfile(data.user);
      window.dispatchEvent(new Event('arcane-auth-changed'));
      window.dispatchEvent(new Event('arcane-profile-refresh'));
      if (onSuccess) onSuccess();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setProfile(null);
    localStorage.removeItem(tokenKey);
    window.dispatchEvent(new Event('arcane-auth-changed'));
  };

  return (
    <section className={compact ? 'auth-section-compact' : 'auth-section'}>
      {!compact && (
        <header className="page-section-head animate-in">
          <p className="page-kicker">Accounts & Profiles</p>
          <h2>Signup and login backed by MongoDB profiles.</h2>
          <p>Each user record stores prompt totals, image totals, edits, fusions, and the account details needed to keep the studio persistent across sessions.</p>
        </header>
      )}

      {compact ? (
        <article className="glass-card auth-form-card auth-form-card-compact animate-in">
          <div className="auth-tab-row">
            <button className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'} onClick={() => setMode('signup')} type="button">Signup</button>
            <button className={mode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => setMode('login')} type="button">Login</button>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <label>
                  <span>Name</span>
                  <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Your name" />
                </label>
                <label>
                  <span>Workspace</span>
                  <input value={form.workspaceName} onChange={(event) => setForm((current) => ({ ...current, workspaceName: event.target.value }))} placeholder="Main Studio" />
                </label>
              </>
            )}
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@domain.com" />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="••••••••" />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button className="cta-main auth-submit" type="submit" disabled={busy}>{busy ? 'Working...' : mode === 'signup' ? 'Create account' : 'Log in'}</button>
          </form>
        </article>
      ) : (
        <div className="auth-grid">
          <article className="glass-card auth-form-card animate-in">
            <div className="auth-tab-row">
              <button className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'} onClick={() => setMode('signup')} type="button">Signup</button>
              <button className={mode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => setMode('login')} type="button">Login</button>
            </div>
            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <>
                  <label>
                    <span>Name</span>
                    <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Your name" />
                  </label>
                  <label>
                    <span>Workspace</span>
                    <input value={form.workspaceName} onChange={(event) => setForm((current) => ({ ...current, workspaceName: event.target.value }))} placeholder="Main Studio" />
                  </label>
                </>
              )}
              <label>
                <span>Email</span>
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@domain.com" />
              </label>
              <label>
                <span>Password</span>
                <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="••••••••" />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button className="cta-main auth-submit" type="submit" disabled={busy}>{busy ? 'Working...' : mode === 'signup' ? 'Create account' : 'Log in'}</button>
            </form>
          </article>

          <article className="glass-card auth-profile-card animate-in">
            <div className="auth-profile-header">
              <div>
                <p className="page-card-kicker">Profile record</p>
                <h3>{profile ? profile.name : 'MongoDB user document'}</h3>
                <p>{profile ? profile.email : 'Sign up or log in to unlock persistent stats.'}</p>
              </div>
              <span className="auth-profile-chip">{profile ? 'Connected' : 'Preview'}</span>
            </div>

            <div className="auth-metrics">
              {profileCards.map((card) => (
                <div className="auth-metric" key={card.label}>
                  <strong>{String(card.value).padStart(2, '0')}</strong>
                  <span>{card.label}</span>
                </div>
              ))}
            </div>

            <div className="auth-pills">
              {['Name and email', 'Password hash', 'Prompts generated', 'Images generated', 'Edits and fusions', 'Last login', 'Workspace', 'Plan and status'].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            {profile && (
              <button className="cta-ghost auth-logout" type="button" onClick={handleLogout}>Log out</button>
            )}
          </article>
        </div>
      )}
    </section>
  );
};

export default AuthSection;