import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useGeminiImage } from './hooks/useGeminiImage';
import ApiKeyInput from './components/ApiKeyInput';
import PromptForm from './components/PromptForm';
import ImageCanvas from './components/ImageCanvas';
import ImageUpload from './components/ImageUpload';
import Toast from './components/Toast';
import ArcaneEngineLive from './components/ArcaneEngineLive';
import AuthSection from './components/AuthSection';

interface GeneratedImage {
  id: string;
  base64: string;
  prompt: string;
  timestamp: Date;
}

type ThemeMode = 'system' | 'light' | 'dark';

interface UserProfile {
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
}

const LoadingScreen: React.FC<{ done: boolean }> = ({ done }) => (
  <div className={`loader-shell ${done ? 'is-exiting' : ''}`}>
    <div className="loader-core">
      <div className="prism-wrap">
        <div className="prism prism-a" />
        <div className="prism prism-b" />
        <div className="prism prism-c" />
      </div>
    </div>
    <h1 className="loader-logo"><span>ARcane</span><em>Engine</em></h1>
    <div className="loader-progress"><span /></div>
    <p className="loader-labs">ARcane Labs · 2026</p>
  </div>
);

const useRevealOnScroll = () => {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.animate-in'));
    if (!elements.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
};

const Navbar: React.FC<{ theme: ThemeMode; onToggle: () => void; authProfile: UserProfile | null }> = ({ theme, onToggle, authProfile }) => {
  const [scrolled, setScrolled] = useState(false);
  const initials = (authProfile?.name || authProfile?.email || 'User').trim().charAt(0).toUpperCase();
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 72);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
  return (
    <header className={`site-nav ${scrolled ? 'site-nav-scrolled' : ''}`}>
      <div className="site-nav-inner">
        <NavLink to="/" className="brand-mark">
          <strong>ARcane</strong><span className="brand-dot" /><em>Engine</em>
        </NavLink>
        <nav className="site-links">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/features">Features</NavLink>
          <NavLink to="/technology">Technology</NavLink>
          <NavLink to="/usecases">Use Cases</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
        <div className="site-right">
          <button className="theme-pill" onClick={onToggle}>
            {theme === 'light' ? '☀ Light' : theme === 'dark' ? '☾ Dark' : '⬡ System'}
          </button>
          {authProfile ? (
            <NavLink to="/profile" className="profile-icon" title="Open profile">
              <span className="profile-avatar">{initials}</span>
            </NavLink>
          ) : (
            <NavLink to="/login" className="cta-ghost">Sign In</NavLink>
          )}
          <NavLink to="/studio" className="cta-main">Try Now →</NavLink>
        </div>
      </div>
    </header>
  );
};

const pageStats = {
  features: ['Tap-to-Edit', 'Text-to-Reality', 'Fusion Mode', 'Live Camera'],
  technology: ['Browser Client', 'Queue Layer', 'Gemini Models', 'Frame Integration'],
  useCases: ['Creatives', 'Product Teams', 'Educators', 'Spatial Design']
};

type PageHeroProps = {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  primaryAction: { label: string; to: string };
  secondaryAction?: { label: string; to: string };
  stats: string[];
  media?: React.ReactNode;
  mediaSide?: 'left' | 'right';
};

const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  stats,
  media,
  mediaSide = 'right'
}) => (
  <section className="page-hero animate-in">
    <div className={`page-hero-main ${mediaSide === 'left' ? 'page-hero-main-left' : 'page-hero-main-right'}`}>
      {media && mediaSide === 'left' && (
        <div className="page-hero-media page-hero-media-left">
          {media}
        </div>
      )}
      <div className="page-hero-copy">
        <p className="hero-eyebrow">{eyebrow}</p>
        <h1 className="hero-title page-title">{title}</h1>
        <p className="hero-sub page-subtitle">{description}</p>
        <div className="hero-cta page-hero-cta">
          <NavLink to={primaryAction.to} className="cta-main">{primaryAction.label}</NavLink>
          {secondaryAction && <NavLink to={secondaryAction.to} className="cta-ghost">{secondaryAction.label}</NavLink>}
        </div>
      </div>
      {media && mediaSide === 'right' && (
        <div className="page-hero-media page-hero-media-right">
          {media}
        </div>
      )}
    </div>
    <div className="hero-pills page-stats">
      {stats.map((stat: string) => <span key={stat}>{stat}</span>)}
    </div>
  </section>
);

const heroVideo = (caption: string) => (
  <div className="hero-video-panel">
    <video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/arcaneenginevid1.mp4">
      <source src="/arcaneenginevid1.mp4" type="video/mp4" />
    </video>
    <div className="hero-video-caption">
      <p className="page-card-kicker"></p>
      <p>{caption}</p>
    </div>
  </div>
);

const SectionHeader: React.FC<{
  eyebrow: string;
  title: string;
  description: string;
}> = ({ eyebrow, title, description }) => (
  <header className="page-section-head animate-in">
    <p className="page-kicker">{eyebrow}</p>
    <h2>{title}</h2>
    <p>{description}</p>
  </header>
);

const HomePage: React.FC = () => {
  useRevealOnScroll();
  const { scrollYProgress } = useScroll();
  const heroBgY = useTransform(scrollYProgress, [0, 0.35], [0, 120]);
  const heroBgScale = useTransform(scrollYProgress, [0, 0.35], [1.08, 1]);
  const heroBgOpacity = useTransform(scrollYProgress, [0, 0.4], [0.62, 0.28]);

  return (
    <div className="page-wrap">
      <section className="hero home-hero">
        <motion.div
          className="home-hero-bg"
          style={{ y: heroBgY, scale: heroBgScale, opacity: heroBgOpacity }}
          aria-hidden="true"
        />
        <div className="home-hero-overlay" aria-hidden="true" />
        <div className="home-hero-content">
          <p className="hero-eyebrow animate-in">ARcane Labs · March 2026</p>
          <h1 className="hero-title">
            <span className="word">Reshape</span> <span className="word">Reality.</span><br />
            <span className="word">In</span> <span className="word">Your</span> <span className="word">Browser.</span>
          </h1>
          <p className="hero-sub animate-in">
            ARcane Engine transforms your live camera feed into an interactive canvas — powered by Gemini 2.5 Flash Image.
          </p>
          <div className="hero-cta animate-in">
            <NavLink to="/studio" className="cta-main">Try It Now →</NavLink>
            <a className="cta-ghost" href="https://brown-kelsey-13.tiiny.site" target="_blank" rel="noreferrer">Read Whitepaper</a>
          </div>
          <div className="hero-pills animate-in">
            <span>&lt; 2s per frame</span><span>0 installs</span><span>∞ creative freedom</span>
          </div>
        </div>
      </section>
      <section className="marquee">
        <div className="marquee-track">Tap-to-Edit ◆ Text-to-Reality ◆ Fusion Mode ◆ Frame Chaining ◆ MobileSAM ◆ WebRTC ◆ Sub-2s Generation ◆ Tap-to-Edit ◆ Text-to-Reality ◆ Fusion Mode ◆ Frame Chaining ◆ MobileSAM ◆ WebRTC ◆ Sub-2s Generation ◆</div>
      </section>
      <section className="pipeline-grid">
        {['Camera Capture', 'Frame Selection', 'Segmentation', 'AI Generation', 'Frame Integration', 'Continuous Update'].map((step, i) => (
          <article key={step} className="pipeline-card animate-in" style={{ ['--index' as string]: Math.min(i, 4) }}>
            <span className="pipeline-num">0{i + 1}</span>
            <h3>{step}</h3>
          </article>
        ))}
      </section>
    </div>
  );
};

const FeaturesPage: React.FC = () => {
  useRevealOnScroll();
  return (
  <div className="page-wrap editorial-page">
    <PageHero
      eyebrow="Product Surface"
      title={<><span>Features built</span> <span>for editable reality.</span></>}
      description="Arcane Engine turns the camera into a creative control surface with prompt edits, image fusion, and fast visual feedback that stays grounded in the frame."
      primaryAction={{ label: 'Open Studio', to: '/studio' }}
      secondaryAction={{ label: 'See Technology', to: '/technology' }}
      stats={pageStats.features}
      media={heroVideo('A moving preview of the live Arcane engine surface.')}
      mediaSide="right"
    />

    <section className="page-section">
      <SectionHeader
        eyebrow="Core capabilities"
        title="Three paths into the same live canvas."
        description="The new interface is intentionally compact: each capability is presented as a direct creative move rather than a menu of abstract tools."
      />
      <div className="page-bento-grid">
        <article className="glass-card page-bento page-bento-wide animate-in">
          <p className="page-card-kicker">Tap-to-Edit</p>
          <h3>Move from selection to transformation in one gesture.</h3>
          <p>Pick a region, write the change, and keep the surrounding composition coherent.</p>
          <div className="page-inline-tags"><span>Targeted edits</span><span>Scene-aware output</span><span>Low friction</span></div>
        </article>
        <article className="glass-card page-bento animate-in">
          <p className="page-card-kicker">Text-to-Reality</p>
          <h3>Prompt in the style of the scene, not a blank canvas.</h3>
          <p>Generate new imagery that respects the live frame so iteration feels immediate.</p>
        </article>
        <article className="glass-card page-bento animate-in">
          <p className="page-card-kicker">Fusion Mode</p>
          <h3>Blend references without losing the original intent.</h3>
          <p>Combine two inputs into a consistent output with style continuity and controlled composition.</p>
        </article>
      </div>
    </section>

    <section className="marquee page-marquee">
      <div className="marquee-track">Tap-to-Edit ◆ Text-to-Reality ◆ Fusion Mode ◆ Live Camera ◆ Prompt Chaining ◆ Frame Awareness ◆ Tap-to-Edit ◆ Text-to-Reality ◆ Fusion Mode ◆ Live Camera ◆ Prompt Chaining ◆ Frame Awareness ◆</div>
    </section>

    <section className="page-section">
      <SectionHeader
        eyebrow="Experience"
        title="The page should feel like the studio: direct, cinematic, and fast."
        description="These panels mirror the homepage language so the rest of the site feels like one coherent product, not a collection of unrelated route pages."
      />
      <div className="pipeline-grid page-feature-flow">
        {[
          ['Focus', 'Pick the region or input that matters most.'],
          ['Compose', 'Layer instructions, references, and structure.'],
          ['Generate', 'Let Gemini produce the transformed result.'],
          ['Refine', 'Iterate without dropping the visual thread.']
        ].map(([title, copy], index) => (
          <article key={title} className="pipeline-card animate-in" style={{ ['--index' as string]: index }}>
            <span className="pipeline-num">0{index + 1}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  </div>
  );
};

const TechnologyPage: React.FC = () => {
  useRevealOnScroll();
  return (
  <div className="page-wrap editorial-page">
    <PageHero
      eyebrow="Architecture"
      title={<><span>Technology designed</span> <span>for realtime iteration.</span></>}
      description="The stack keeps the interface lightweight while handling camera input, model selection, request throttling, and frame-level updates behind the scenes."
      primaryAction={{ label: 'Open Studio', to: '/studio' }}
      secondaryAction={{ label: 'Explore Features', to: '/features' }}
      stats={pageStats.technology}
      media={heroVideo('The same video panel, anchored on the left to balance the section rhythm.')}
      mediaSide="left"
    />

    <section className="page-section">
      <SectionHeader
        eyebrow="System map"
        title="Each layer does one thing well."
        description="The app is split into a visible creative surface and a small set of predictable runtime systems that keep generation responsive."
      />
      <div className="page-tech-grid">
        {[
          ['Browser Client', 'React + Vite keeps the UI snappy and lets the studio respond immediately to local input.'],
          ['Camera + Capture', 'The live stream is normalized into frame-ready data before any model call happens.'],
          ['Model Routing', 'Image generation resolves a compatible Gemini model with fallback handling when a preferred model is unavailable.'],
          ['Queue + Throttle', 'Requests are serialized with spacing so edits remain stable under repeated interaction.']
        ].map(([title, copy], index) => (
          <article key={title} className="glass-card page-tech-card animate-in" style={{ ['--index' as string]: index }}>
            <p className="page-card-kicker">0{index + 1}</p>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="page-section">
      <SectionHeader
        eyebrow="Pipeline"
        title="A compact flow from camera to canvas."
        description="The homepage already hints at the process. This page makes the runtime path explicit without turning it into a wall of documentation."
      />
      <div className="pipeline-grid">
        {[
          ['Capture', 'Open the camera or upload source material.'],
          ['Select', 'Choose the area or reference the model should respect.'],
          ['Transform', 'Send the prompt through the routed Gemini image model.'],
          ['Render', 'Bring the returned image back into the canvas.'],
          ['Repeat', 'Keep refining while the visual context remains intact.']
        ].map((step, index) => (
          <article key={step[0]} className="pipeline-card animate-in" style={{ ['--index' as string]: index }}>
            <span className="pipeline-num">0{index + 1}</span>
            <h3>{step[0]}</h3>
            <p>{step[1]}</p>
          </article>
        ))}
      </div>
    </section>
  </div>
  );
};

const UseCasesPage: React.FC = () => {
  useRevealOnScroll();
  return (
  <div className="page-wrap editorial-page">
    <PageHero
      eyebrow="Use Cases"
      title={<><span>Built for teams</span> <span>that think in scenes.</span></>}
      description="Arcane Engine fits workflows where the visual output needs to stay close to the source of truth: concepting, mockups, live demos, and high-context creative review."
      primaryAction={{ label: 'Try Live Mode', to: '/live' }}
      secondaryAction={{ label: 'See Features', to: '/features' }}
      stats={pageStats.useCases}
      media={heroVideo('A cinematic cue that signals motion, transformation, and iteration.')}
      mediaSide="right"
    />

    <section className="page-section">
      <SectionHeader
        eyebrow="Scenarios"
        title="Where the product surface makes sense immediately."
        description="These are the kinds of workflows that benefit from fast prompts, image awareness, and a UI that does not get in the way."
      />
      <div className="page-usecase-grid">
        {[
          ['Creative direction', 'Iterate on concepts, variants, and mood shifts while keeping a coherent visual thread.'],
          ['Product and marketing', 'Produce campaign visuals, landing mockups, and compositional studies with tight feedback loops.'],
          ['Architecture and interiors', 'Move from reference imagery to localized changes without rebuilding the whole scene.'],
          ['Education and demos', 'Show how prompt-driven image workflows work in a way that feels tangible and memorable.']
        ].map((item, index) => (
          <article key={item[0]} className="glass-card page-usecase-card animate-in" style={{ ['--index' as string]: index }}>
            <p className="page-card-kicker">0{index + 1}</p>
            <h3>{item[0]}</h3>
            <p>{item[1]}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="page-section">
      <div className="glass-card page-quote animate-in">
        <p className="page-card-kicker">Best fit</p>
        <blockquote>
          Keep the creation loop visible. The UI should make it obvious what changes, why it changes, and how quickly the result can be refined.
        </blockquote>
      </div>
    </section>
  </div>
  );
};

const AboutPage: React.FC = () => (
  <div className="page-wrap about-wrap">
    <h2>ARcane Labs</h2>
    <p>ARcane Engine represents more than an incremental improvement in AR technology — it marks a fundamental shift in how humans interact with and reshape their visual reality.</p>
    <a href="https://github.com/agnivo988" target="_blank" rel="noreferrer">$ github.com/agnivo988</a>
    <a href="https://github.com/Priyangshu-7" target="_blank" rel="noreferrer">$ github.com/Priyangshu-7</a>
  </div>
);

const ProfilePage: React.FC<{
  profile: UserProfile | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}> = ({ profile, isLoading, onRefresh, onLogout }) => {
  useRevealOnScroll();

  return (
    <div className="page-wrap editorial-page profile-page-wrap">
      <PageHero
        eyebrow="My Profile"
        title={<><span>Your Arcane</span> <span>usage dashboard.</span></>}
        description="This page loads your account data from MongoDB and shows your creative activity, workspace settings, and account status."
        primaryAction={{ label: 'Open Studio', to: '/studio' }}
        secondaryAction={{ label: 'Refresh Data', to: '/profile' }}
        stats={['MongoDB Synced', 'JWT Session', 'Realtime Counters']}
      />

      <section className="page-section profile-stack">
        <article className="glass-card profile-identity animate-in">
          <div>
            <p className="page-card-kicker">Account</p>
            <h3>{profile?.name || 'Loading profile...'}</h3>
            <p>{profile?.email || 'No profile data yet.'}</p>
          </div>
          <div className="profile-actions">
            <button className="cta-ghost" onClick={() => void onRefresh()} type="button" disabled={isLoading}>Refresh</button>
            <button className="cta-main" onClick={onLogout} type="button">Log out</button>
          </div>
        </article>

        <div className="profile-metrics-grid">
          {[
            { label: 'Prompts Generated', value: profile?.promptsGenerated ?? 0 },
            { label: 'Images Generated', value: profile?.imagesGenerated ?? 0 },
            { label: 'Images Edited', value: profile?.imagesEdited ?? 0 },
            { label: 'Images Fused', value: profile?.imagesFused ?? 0 }
          ].map((item) => (
            <article key={item.label} className="glass-card profile-metric animate-in">
              <strong>{String(item.value).padStart(2, '0')}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>

        <article className="glass-card profile-details animate-in">
          <p className="page-card-kicker">Database Fields</p>
          <div className="profile-detail-list">
            <p><strong>Workspace:</strong> {profile?.workspaceName || 'Main Studio'}</p>
            <p><strong>Plan:</strong> {profile?.plan || 'creator'}</p>
            <p><strong>Status:</strong> {profile?.status || 'active'}</p>
            <p><strong>Last Login:</strong> {profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : 'N/A'}</p>
            <p><strong>Created:</strong> {profile?.createdAt ? new Date(profile.createdAt).toLocaleString() : 'N/A'}</p>
          </div>
        </article>
      </section>
    </div>
  );
};

type AuthPageMode = 'signup' | 'login';

const AuthPage: React.FC<{ initialMode: AuthPageMode }> = ({ initialMode }) => {
  useRevealOnScroll();
  const navigate = useNavigate();

  return (
    <div className="page-wrap editorial-page">
      <PageHero
        eyebrow={initialMode === 'signup' ? 'Create Account' : 'Welcome Back'}
        title={initialMode === 'signup' ? <>Create your <span>ARcane Studio.</span></> : <>Sign into <span>your workspace.</span></>}
        description={initialMode === 'signup' 
          ? 'Set up your account to start transforming reality with AI-powered image generation. Track your prompts, edits, and creations all in one place.'
          : 'Access your creative workspace and continue where you left off. Track your usage and bring your AR vision to life.'}
        primaryAction={{ label: initialMode === 'signup' ? 'Get Started' : 'Continue', to: '#' }}
        stats={initialMode === 'signup' ? ['Free Account', '0 Installs', 'Unlimited Creativity'] : ['Secure Login', 'Usage Tracking', 'Your Workspace']}
      />
      <AuthSection defaultMode={initialMode} compact onSuccess={() => {
        setTimeout(() => navigate('/studio'), 800);
      }} />
    </div>
  );
};

const SiteChrome: React.FC<{ children: React.ReactNode; theme: ThemeMode; onToggleTheme: () => void; authProfile: UserProfile | null }> = ({ children, theme, onToggleTheme, authProfile }) => (
  <>
    <div className="glare-layer"><div className="glare-beam" /></div>
    <Navbar theme={theme} onToggle={onToggleTheme} authProfile={authProfile} />
    <main className="site-content">{children}</main>
    <footer className="site-footer"><p>ARcane Labs · 2026 · Reality is editable.</p></footer>
  </>
);

const AppRoutes: React.FC<{ theme: ThemeMode; onToggleTheme: () => void }> = ({ theme, onToggleTheme }) => {
  const [apiKey, setApiKey] = useState('');
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [uploadedImages, setUploadedImages] = useState<{ img1: string | null; img2: string | null }>({ img1: null, img2: null });
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('arcane-auth-token'));
  const [authProfile, setAuthProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { generateImage, editImage, fuseImages, isLoading, error, clearError } = useGeminiImage(apiKey);

  const fetchAuthProfile = async (token: string) => {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to load profile');
    const data = await response.json();
    return data.user as UserProfile;
  };

  const clearAuth = () => {
    localStorage.removeItem('arcane-auth-token');
    setAuthToken(null);
    setAuthProfile(null);
  };

  const refreshAuthProfile = async () => {
    if (!authToken) {
      setAuthProfile(null);
      return;
    }
    try {
      setAuthLoading(true);
      const user = await fetchAuthProfile(authToken);
      setAuthProfile(user);
    } catch {
      clearAuth();
    } finally {
      setAuthLoading(false);
    }
  };

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const trackStudioSubmit = async (action: 'generate' | 'edit' | 'fuse') => {
    const authToken = localStorage.getItem('arcane-auth-token');
    if (!authToken) return;

    try {
      const response = await fetch('/api/auth/me/usage/event', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        window.dispatchEvent(new Event('arcane-profile-refresh'));
      }
    } catch {
      // Ignore profile sync failures so the creative flow stays responsive.
    }
  };

  useEffect(() => {
    if (error) {
      showToast(error, 'error');
      clearError();
    }
  }, [error, clearError]);

  useEffect(() => {
    const syncToken = () => setAuthToken(localStorage.getItem('arcane-auth-token'));
    window.addEventListener('arcane-auth-changed', syncToken as EventListener);
    window.addEventListener('storage', syncToken);
    return () => {
      window.removeEventListener('arcane-auth-changed', syncToken as EventListener);
      window.removeEventListener('storage', syncToken);
    };
  }, []);

  useEffect(() => {
    void refreshAuthProfile();
  }, [authToken]);

  useEffect(() => {
    const handleUsageRefresh = () => {
      void refreshAuthProfile();
    };
    window.addEventListener('arcane-profile-refresh', handleUsageRefresh);
    return () => window.removeEventListener('arcane-profile-refresh', handleUsageRefresh);
  }, [authToken]);

  const logoutAndGoToLogin = () => {
    clearAuth();
    window.dispatchEvent(new Event('arcane-auth-changed'));
    navigate('/login');
  };

  const openLiveMode = () => {
    if (!apiKey) {
      showToast('Set API key in Studio before launching Live mode.', 'error');
      navigate('/studio');
      return;
    }
    navigate('/live');
  };

  const handleGenerate = async (prompt: string) => {
    try {
      const base64 = await generateImage(prompt);
      setCurrentImage({ id: Date.now().toString(), base64, prompt, timestamp: new Date() });
      void trackStudioSubmit('generate');
      showToast('Image generated successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate image', 'error');
    }
  };
  const handleEdit = async (prompt: string) => {
    if (!currentImage) return showToast('No image to edit. Generate an image first.', 'error');
    try {
      const base64 = await editImage(currentImage.base64, prompt);
      setCurrentImage({ id: Date.now().toString(), base64, prompt: `${currentImage.prompt} → ${prompt}`, timestamp: new Date() });
      void trackStudioSubmit('edit');
      showToast('Image edited successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to edit image', 'error');
    }
  };
  const handleFuse = async (prompt: string) => {
    if (!uploadedImages.img1 || !uploadedImages.img2) return showToast('Please upload two images to fuse.', 'error');
    try {
      const base64 = await fuseImages(uploadedImages.img1, uploadedImages.img2, prompt);
      setCurrentImage({ id: Date.now().toString(), base64, prompt: `Fused: ${prompt}`, timestamp: new Date() });
      void trackStudioSubmit('fuse');
      showToast('Images fused successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to fuse images', 'error');
    }
  };

  const studioActions = useMemo(() => (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={() => navigate('/technology')} className="arcane-btn arcane-btn-ghost">Architecture</button>
      <button onClick={openLiveMode} disabled={!apiKey} className="arcane-btn arcane-btn-primary disabled:opacity-45 disabled:cursor-not-allowed">Enter Live</button>
    </div>
  ), [navigate, apiKey]);

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}><HomePage /></SiteChrome>} />
          <Route path="/features" element={<SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}><FeaturesPage /></SiteChrome>} />
          <Route path="/technology" element={<SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}><TechnologyPage /></SiteChrome>} />
          <Route path="/usecases" element={<SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}><UseCasesPage /></SiteChrome>} />
          <Route path="/use-cases" element={<Navigate to="/usecases" replace />} />
          <Route path="/about" element={<SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}><AboutPage /></SiteChrome>} />
          <Route path="/signup" element={<SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}><AuthPage initialMode="signup" /></SiteChrome>} />
          <Route path="/login" element={<SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}><AuthPage initialMode="login" /></SiteChrome>} />
          <Route
            path="/profile"
            element={
              authToken ? (
                <SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}>
                  <ProfilePage profile={authProfile} isLoading={authLoading} onRefresh={refreshAuthProfile} onLogout={logoutAndGoToLogin} />
                </SiteChrome>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="/live" element={<ArcaneEngineLive apiKey={apiKey} onBackToStudio={() => navigate('/studio')} />} />
          <Route
            path="/studio"
            element={
              <SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}>
                <motion.div className="min-h-screen app-surface text-slate-100 p-4 sm:p-6 lg:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="max-w-7xl mx-auto">
                    <header className="mb-8">
                      <motion.div className="glass-panel rounded-3xl px-5 py-5 sm:px-7 sm:py-6" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/75">Realtime Creative Studio</p>
                            <h1 className="brand-title text-4xl sm:text-5xl">ARcane Engine</h1>
                            <p className="text-slate-300 mt-2">Fast visual iteration for camera-based world transformation.</p>
                          </div>
                          {studioActions}
                        </div>
                      </motion.div>
                    </header>
                    <div className="flow-strip mb-6">
                      {['Camera', 'Select', 'Mask', 'Generate', 'Blend'].map((item, idx) => <span key={item} className="flow-pill">{idx + 1}. {item}</span>)}
                    </div>
                    <ApiKeyInput apiKey={apiKey} onApiKeyChange={setApiKey} />
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
                      <div className="space-y-6">
                        <PromptForm onGenerate={handleGenerate} onEdit={handleEdit} onFuse={handleFuse} isLoading={isLoading} hasImage={!!currentImage} hasUploadedImages={!!(uploadedImages.img1 && uploadedImages.img2)} />
                        <div className="glass-panel rounded-2xl p-6">
                          <h3 className="text-lg font-semibold mb-4">Fusion Inputs</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <ImageUpload label="Source A" onImageUpload={(base64) => setUploadedImages((prev) => ({ ...prev, img1: base64 }))} currentImage={uploadedImages.img1} />
                            <ImageUpload label="Source B" onImageUpload={(base64) => setUploadedImages((prev) => ({ ...prev, img2: base64 }))} currentImage={uploadedImages.img2} />
                          </div>
                        </div>
                      </div>
                      <div>
                        <ImageCanvas image={currentImage} isLoading={isLoading} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </SiteChrome>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

const App: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('arcane-theme') as ThemeMode) || 'system');
  const [isBooting, setIsBooting] = useState(true);
  const [loaderDone, setLoaderDone] = useState(false);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const applyTheme = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    };
    applyTheme();
    media.addEventListener('change', applyTheme);
    localStorage.setItem('arcane-theme', theme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    const done = window.setTimeout(() => setLoaderDone(true), 2000);
    const close = window.setTimeout(() => setIsBooting(false), 2200);
    return () => {
      window.clearTimeout(done);
      window.clearTimeout(close);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches || !dotRef.current || !ringRef.current) return;
    let raf = 0;
    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;
    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (dotRef.current) dotRef.current.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    };
    const animate = () => {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      if (ringRef.current) ringRef.current.style.transform = `translate(${ringX}px, ${ringY}px)`;
      raf = window.requestAnimationFrame(animate);
    };
    window.addEventListener('mousemove', onMove);
    animate();
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
      {isBooting ? <LoadingScreen done={loaderDone} /> : <AppRoutes theme={theme} onToggleTheme={() => setTheme((prev) => (prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system'))} />}
    </>
  );
};

export default App;