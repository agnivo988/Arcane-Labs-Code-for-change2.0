import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
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

interface StoredGeneratedImage {
  id: string;
  base64: string;
  prompt: string;
  timestamp: string;
}

interface StudioSessionSnapshot {
  apiKey: string;
  currentImage: StoredGeneratedImage | null;
  imageHistory: StoredGeneratedImage[];
  compareSelection: { left: string | null; right: string | null };
}

interface ServerSessionState {
  currentImage: { id: string; prompt: string; timestamp: string; base64?: string } | null;
  imageHistory: Array<{ id: string; prompt: string; timestamp: string; base64?: string }>;
  compareSelection: { left: string | null; right: string | null };
  lastActivity?: { id: string; text: string; actor?: string; timestamp: string };
  updatedAt?: string;
}

interface CollaborationLoadResponse {
  code: string;
  session: ServerSessionState;
  createdAt?: string;
  expiresAt?: string;
}

interface CollaborationActivity {
  id: string;
  text: string;
  actor?: string;
  timestamp: string;
}

const STUDIO_SESSION_STORAGE_KEY = 'arcane-studio-session-v1';
const COLLAB_WS_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:4000';

const toStoredImage = (image: GeneratedImage): StoredGeneratedImage => ({
  ...image,
  timestamp: image.timestamp.toISOString()
});

const fromStoredImage = (image: StoredGeneratedImage): GeneratedImage => ({
  ...image,
  timestamp: new Date(image.timestamp)
});

const toServerImageMeta = (image: GeneratedImage) => ({
  id: image.id,
  prompt: image.prompt,
  timestamp: image.timestamp.toISOString()
});

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
  const [imageHistory, setImageHistory] = useState<GeneratedImage[]>([]);
  const [uploadedImages, setUploadedImages] = useState<{ img1: string | null; img2: string | null }>({ img1: null, img2: null });
  const [compareSelection, setCompareSelection] = useState<{ left: string | null; right: string | null }>({ left: null, right: null });
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('arcane-auth-token'));
  const [authProfile, setAuthProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [hasHydratedServerSession, setHasHydratedServerSession] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareInput, setShareInput] = useState('');
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [isImportingShare, setIsImportingShare] = useState(false);
  const [activeCollabCode, setActiveCollabCode] = useState('');
  const [collabStatus, setCollabStatus] = useState<'idle' | 'connecting' | 'live'>('idle');
  const [collabActivities, setCollabActivities] = useState<CollaborationActivity[]>([]);
  const collabSocketRef = useRef<Socket | null>(null);
  const suppressCollabSyncRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { generateImage, editImage, fuseImages, isLoading, error, clearError } = useGeminiImage(apiKey);
  const historyLookup = useMemo(() => new Map(imageHistory.map((image) => [image.id, image])), [imageHistory]);
  const compareLeft = compareSelection.left ? historyLookup.get(compareSelection.left) || null : null;
  const compareRight = compareSelection.right ? historyLookup.get(compareSelection.right) || null : null;
  const isCompareReady = !!(compareLeft && compareRight && compareLeft.id !== compareRight.id);
  const visibleHistory = imageHistory.length ? imageHistory : currentImage ? [currentImage] : [];

  const toGeneratedImage = (item: { id: string; prompt: string; timestamp: string; base64?: string }) => ({
    id: item.id,
    prompt: item.prompt,
    base64: typeof item.base64 === 'string' ? item.base64 : '',
    timestamp: new Date(item.timestamp)
  });

  const extractCollabCode = (input: string) => {
    const raw = input.trim();
    if (!raw) return '';
    if (/^[A-Za-z0-9]{6,12}$/.test(raw)) return raw.toUpperCase();

    try {
      const parsed = new URL(raw);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const collabIdx = parts.findIndex((part) => part.toLowerCase() === 'collab');
      if (collabIdx !== -1 && parts[collabIdx + 1]) {
        return parts[collabIdx + 1].toUpperCase();
      }
    } catch {
      return '';
    }

    return '';
  };

  const applyIncomingSession = (session: ServerSessionState) => {
    const sourceHistory = Array.isArray(session.imageHistory) && session.imageHistory.length > 0
      ? session.imageHistory
      : session.currentImage
        ? [session.currentImage]
        : [];
    const incomingHistory = sourceHistory
      .filter((item) => item && item.id && item.prompt)
      .map(toGeneratedImage);

    if (session.currentImage) {
      setCurrentImage(toGeneratedImage(session.currentImage));
    }

    setImageHistory((prev) => {
      const incomingById = new Map(incomingHistory.map((item) => [item.id, item]));
      const merged = [
        ...incomingHistory,
        ...prev.filter((item) => !incomingById.has(item.id))
      ].slice(0, 24);
      return merged;
    });

    if (session.compareSelection) {
      setCompareSelection(session.compareSelection);
    }

    if (session.lastActivity?.id && session.lastActivity?.text) {
      setCollabActivities((prev) => [session.lastActivity as CollaborationActivity, ...prev.filter((item) => item.id !== session.lastActivity?.id)].slice(0, 30));
    }
  };

  const emitCollabActivity = (text: string) => {
    if (!activeCollabCode) return;
    const activity: CollaborationActivity = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      actor: authProfile?.name || authProfile?.email || 'Collaborator',
      timestamp: new Date().toISOString()
    };
    setCollabActivities((prev) => [activity, ...prev].slice(0, 30));

    const socket = collabSocketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit('collab:state', {
      code: activeCollabCode,
      session: {
        currentImage: currentImage
          ? {
            id: currentImage.id,
            prompt: currentImage.prompt,
            timestamp: currentImage.timestamp.toISOString(),
            ...(currentImage.base64 ? { base64: currentImage.base64.slice(0, 1_200_000) } : {})
          }
          : null,
        imageHistory: imageHistory.slice(0, 10).map((item) => ({
          id: item.id,
          prompt: item.prompt,
          timestamp: item.timestamp.toISOString()
        })),
        compareSelection,
        lastActivity: activity,
        updatedAt: new Date().toISOString()
      } as ServerSessionState
    });
  };

  const importCollaborationCode = async (input: string) => {
    const code = extractCollabCode(input);
    if (!code) {
      showToast('Enter a valid collaboration code or full link.', 'error');
      return;
    }

    try {
      setIsImportingShare(true);
      const response = await fetch(`/api/collab/${code}`);
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'Collaboration link not found.' : 'Could not import collaboration link.');
      }
      const data = (await response.json()) as CollaborationLoadResponse;
      if (!data.session) throw new Error('This collaboration link has no session data.');
      applyIncomingSession(data.session);
      setActiveCollabCode(code);
      const liveUrl = `${window.location.origin}/collab/${code}`;
      setShareLink(liveUrl);
      setShareInput('');
      navigate(`/studio?collab=${code}`);
      showToast('Collaboration session imported.', 'success');
      emitCollabActivity('joined the collaboration room');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import collaboration link.', 'error');
    } finally {
      setIsImportingShare(false);
    }
  };

  const createCollaborationLink = async () => {
    if (!authToken) {
      showToast('Sign in to create collaboration links.', 'error');
      navigate('/login');
      return;
    }

    try {
      setIsCreatingShare(true);
      const currentBase64 = currentImage?.base64 || '';
      const includeCurrentBase64 = currentBase64.length > 0 && currentBase64.length <= 1_200_000;
      const collabHistory = imageHistory.slice(0, 8).map((item) => ({
        id: item.id,
        prompt: item.prompt,
        timestamp: item.timestamp.toISOString()
      }));

      const collabCurrent = currentImage
        ? {
          id: currentImage.id,
          prompt: currentImage.prompt,
          timestamp: currentImage.timestamp.toISOString(),
          ...(includeCurrentBase64 ? { base64: currentBase64 } : {})
        }
        : null;

      const payload: ServerSessionState = {
        currentImage: collabCurrent,
        imageHistory: collabHistory,
        compareSelection,
        updatedAt: new Date().toISOString()
      };

      const response = await fetch('/api/collab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ session: payload, expiresInDays: 7 })
      });

      if (!response.ok) {
        throw new Error('Could not create collaboration link.');
      }

      const data = (await response.json()) as { code: string };
      const url = `${window.location.origin}/collab/${data.code}`;
      setActiveCollabCode(data.code);
      setShareLink(url);
      setShareInput(url);
      navigate(`/studio?collab=${data.code}`);
      try {
        await navigator.clipboard.writeText(url);
        showToast('Collaboration link created and copied.', 'success');
      } catch {
        showToast('Collaboration link created.', 'success');
      }
      emitCollabActivity('started a collaboration session');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create collaboration link.', 'error');
    } finally {
      setIsCreatingShare(false);
    }
  };

  const fetchAuthProfile = async (token: string) => {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to load profile');
    const data = await response.json();
    return data.user as UserProfile;
  };

  const fetchServerSession = async (token: string) => {
    const response = await fetch('/api/auth/me/session', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to load session');
    const data = await response.json();
    return (data.session as ServerSessionState | null) || null;
  };

  const saveServerSession = async (token: string, session: ServerSessionState) => {
    await fetch('/api/auth/me/session', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ session })
    });
  };

  const clearServerSession = async (token: string) => {
    await fetch('/api/auth/me/session', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
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
    try {
      const raw = localStorage.getItem(STUDIO_SESSION_STORAGE_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as StudioSessionSnapshot;
      if (snapshot.apiKey) setApiKey(snapshot.apiKey);
      if (snapshot.currentImage) setCurrentImage(fromStoredImage(snapshot.currentImage));
      if (Array.isArray(snapshot.imageHistory)) {
        setImageHistory(snapshot.imageHistory.slice(0, 24).map(fromStoredImage));
      }
      if (snapshot.compareSelection) setCompareSelection(snapshot.compareSelection);
    } catch {
      localStorage.removeItem(STUDIO_SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const snapshot: StudioSessionSnapshot = {
      apiKey,
      currentImage: currentImage ? toStoredImage(currentImage) : null,
      imageHistory: imageHistory.map(toStoredImage),
      compareSelection
    };
    try {
      localStorage.setItem(STUDIO_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore quota errors to keep studio responsive on large image payloads.
    }
  }, [apiKey, currentImage, imageHistory, compareSelection]);

  useEffect(() => {
    if (!authToken) {
      setHasHydratedServerSession(true);
      return;
    }
    let cancelled = false;

    const hydrate = async () => {
      try {
        const serverSession = await fetchServerSession(authToken);
        if (!serverSession || cancelled) return;

        setImageHistory((prev) => {
          const localById = new Map(prev.map((item) => [item.id, item]));
          const hasServerHistory = Array.isArray(serverSession.imageHistory) && serverSession.imageHistory.length > 0;
          const historySource = hasServerHistory
            ? serverSession.imageHistory
            : serverSession.currentImage
              ? [serverSession.currentImage]
              : [];

          const serverHistory = historySource.map((item) => {
              const local = localById.get(item.id);
              if (local) return local;
              return {
                id: item.id,
                prompt: item.prompt,
                base64: typeof item.base64 === 'string' ? item.base64 : '',
                timestamp: new Date(item.timestamp)
              } as GeneratedImage;
            });

          const merged = [
            ...serverHistory,
            ...prev.filter((item) => !serverHistory.some((serverItem) => serverItem.id === item.id))
          ].slice(0, 24);

          return merged;
        });

        if (serverSession.currentImage) {
          const serverCurrent = serverSession.currentImage;
          setCurrentImage((prev) => {
            if (prev?.id === serverCurrent.id) return prev;
            if (prev && prev.base64 && prev.id !== serverCurrent.id) return prev;
            return {
              id: serverCurrent.id,
              prompt: serverCurrent.prompt,
              base64: typeof serverCurrent.base64 === 'string' ? serverCurrent.base64 : '',
              timestamp: new Date(serverCurrent.timestamp)
            };
          });
        }

        if (serverSession.compareSelection) {
          setCompareSelection(serverSession.compareSelection);
        }
      } catch {
        // Fallback to local session if backend session is unavailable.
      } finally {
        if (!cancelled) setHasHydratedServerSession(true);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !hasHydratedServerSession) return;
    const timer = window.setTimeout(() => {
      const payload: ServerSessionState = {
        currentImage: currentImage ? toServerImageMeta(currentImage) : null,
        imageHistory: imageHistory.map(toServerImageMeta),
        compareSelection,
        updatedAt: new Date().toISOString()
      };
      void saveServerSession(authToken, payload);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [authToken, hasHydratedServerSession, currentImage, imageHistory, compareSelection]);

  useEffect(() => {
    if (location.pathname !== '/studio') return;
    const codeFromQuery = new URLSearchParams(location.search).get('collab');
    const code = codeFromQuery && /^[A-Za-z0-9]{6,12}$/.test(codeFromQuery)
      ? codeFromQuery.toUpperCase()
      : '';
    if (code && code !== activeCollabCode) {
      setActiveCollabCode(code);
      setShareLink(`${window.location.origin}/collab/${code}`);
    }
  }, [location.pathname, location.search, activeCollabCode]);

  useEffect(() => {
    if (!activeCollabCode) {
      setCollabStatus('idle');
      if (collabSocketRef.current) {
        collabSocketRef.current.disconnect();
        collabSocketRef.current = null;
      }
      return;
    }

    setCollabStatus('connecting');
    const socket = io(COLLAB_WS_ORIGIN, { transports: ['websocket', 'polling'] });
    collabSocketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('collab:join', { code: activeCollabCode });
    });

    socket.on('collab:session', (payload: { code: string; session: ServerSessionState }) => {
      if (!payload?.session) return;
      if (payload.code && payload.code.toUpperCase() !== activeCollabCode.toUpperCase()) return;
      suppressCollabSyncRef.current = true;
      applyIncomingSession(payload.session);
      setCollabStatus('live');
    });

    socket.on('collab:error', (payload: { message?: string }) => {
      setCollabStatus('idle');
      showToast(payload?.message || 'Collaboration connection failed.', 'error');
    });

    socket.on('disconnect', () => {
      setCollabStatus('connecting');
    });

    return () => {
      socket.disconnect();
      if (collabSocketRef.current === socket) {
        collabSocketRef.current = null;
      }
    };
  }, [activeCollabCode]);

  useEffect(() => {
    if (!activeCollabCode) return;
    const socket = collabSocketRef.current;
    if (!socket || !socket.connected) return;
    if (suppressCollabSyncRef.current) {
      suppressCollabSyncRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      const currentBase64 = currentImage?.base64 || '';
      const includeCurrentBase64 = currentBase64.length > 0 && currentBase64.length <= 1_200_000;
      const payload: ServerSessionState = {
        currentImage: currentImage
          ? {
            id: currentImage.id,
            prompt: currentImage.prompt,
            timestamp: currentImage.timestamp.toISOString(),
            ...(includeCurrentBase64 ? { base64: currentBase64 } : {})
          }
          : null,
        imageHistory: imageHistory.slice(0, 10).map((item) => ({
          id: item.id,
          prompt: item.prompt,
          timestamp: item.timestamp.toISOString()
        })),
        compareSelection,
        lastActivity: undefined,
        updatedAt: new Date().toISOString()
      };
      socket.emit('collab:state', { code: activeCollabCode, session: payload });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [activeCollabCode, currentImage, imageHistory, compareSelection]);

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
    void (async () => {
      const token = localStorage.getItem('arcane-auth-token');
      if (token) {
        try {
          await clearServerSession(token);
        } catch {
          // Continue local logout even if backend session clear fails.
        }
      }
      clearAuth();
      window.dispatchEvent(new Event('arcane-auth-changed'));
      navigate('/login');
    })();
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
      const nextImage = { id: Date.now().toString(), base64, prompt, timestamp: new Date() };
      setCurrentImage(nextImage);
      setImageHistory((prev) => [nextImage, ...prev.filter((item) => item.id !== nextImage.id)].slice(0, 24));
      void trackStudioSubmit('generate');
      emitCollabActivity(`generated: ${prompt.slice(0, 80)}`);
      showToast('Image generated successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate image', 'error');
    }
  };
  const handleEdit = async (prompt: string) => {
    if (!currentImage) return showToast('No image to edit. Generate an image first.', 'error');
    try {
      const base64 = await editImage(currentImage.base64, prompt);
      const nextImage = { id: Date.now().toString(), base64, prompt: `${currentImage.prompt} → ${prompt}`, timestamp: new Date() };
      setCurrentImage(nextImage);
      setImageHistory((prev) => [nextImage, ...prev.filter((item) => item.id !== nextImage.id)].slice(0, 24));
      void trackStudioSubmit('edit');
      emitCollabActivity(`edited image: ${prompt.slice(0, 80)}`);
      showToast('Image edited successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to edit image', 'error');
    }
  };
  const handleFuse = async (prompt: string) => {
    if (!uploadedImages.img1 || !uploadedImages.img2) return showToast('Please upload two images to fuse.', 'error');
    try {
      const base64 = await fuseImages(uploadedImages.img1, uploadedImages.img2, prompt);
      const nextImage = { id: Date.now().toString(), base64, prompt: `Fused: ${prompt}`, timestamp: new Date() };
      setCurrentImage(nextImage);
      setImageHistory((prev) => [nextImage, ...prev.filter((item) => item.id !== nextImage.id)].slice(0, 24));
      void trackStudioSubmit('fuse');
      emitCollabActivity(`fused sources: ${prompt.slice(0, 80)}`);
      showToast('Images fused successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to fuse images', 'error');
    }
  };

  const clearStudioSession = () => {
    setCurrentImage(null);
    setUploadedImages({ img1: null, img2: null });
    setImageHistory([]);
    setCompareSelection({ left: null, right: null });
    localStorage.removeItem(STUDIO_SESSION_STORAGE_KEY);
    const token = localStorage.getItem('arcane-auth-token');
    if (token) {
      void clearServerSession(token);
    }
    emitCollabActivity('cleared studio session');
    showToast('Studio session cleared.', 'success');
  };

  const studioActions = useMemo(() => (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={() => navigate('/collaboration')} className="arcane-btn arcane-btn-ghost">Collaborate</button>
      <button onClick={() => navigate('/technology')} className="arcane-btn arcane-btn-ghost">Architecture</button>
      <button onClick={openLiveMode} disabled={!apiKey} className="arcane-btn arcane-btn-primary disabled:opacity-45 disabled:cursor-not-allowed">Enter Live</button>
    </div>
  ), [navigate, apiKey]);

  const CollaborationHubPage: React.FC = () => (
    <SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}>
      <motion.section className="min-h-[70vh] p-6 sm:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="max-w-3xl mx-auto glass-panel rounded-3xl p-6 sm:p-8 space-y-5">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/75">Collaboration Hub</p>
          <h1 className="brand-title text-3xl sm:text-4xl">Live Studio Collaboration</h1>
          <p className="text-slate-300">Create or join a room, then both collaborators can see studio activities live.</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
            <input
              type="text"
              value={shareInput}
              onChange={(e) => setShareInput(e.target.value)}
              placeholder="Paste collaboration link or code"
              className="w-full rounded-xl bg-slate-950/60 border border-white/15 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
            />
            <button className="arcane-btn arcane-btn-ghost" type="button" onClick={createCollaborationLink} disabled={isCreatingShare}>
              {isCreatingShare ? 'Creating...' : 'Create Link'}
            </button>
            <button className="arcane-btn arcane-btn-primary" type="button" onClick={() => void importCollaborationCode(shareInput)} disabled={!shareInput.trim() || isImportingShare}>
              {isImportingShare ? 'Joining...' : 'Join'}
            </button>
          </div>
          {shareLink && <p className="text-xs text-cyan-200/85 break-all">Active link: {shareLink}</p>}
          {activeCollabCode && (
            <div className="flex flex-wrap gap-3 items-center">
              <p className="text-sm text-slate-200">Room: <span className="text-cyan-200">{activeCollabCode}</span></p>
              <button className="arcane-btn arcane-btn-primary" type="button" onClick={() => navigate(`/studio?collab=${activeCollabCode}`)}>Open Collaborative Studio</button>
            </div>
          )}
        </div>
      </motion.section>
    </SiteChrome>
  );

  const CollaborationLinkPage: React.FC = () => {
    const { code } = useParams();
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [linkData, setLinkData] = useState<CollaborationLoadResponse | null>(null);

    useEffect(() => {
      let cancelled = false;
      const load = async () => {
        if (!code) {
          setErrorMessage('Missing collaboration code.');
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const response = await fetch(`/api/collab/${code}`);
          if (!response.ok) {
            throw new Error(response.status === 404 ? 'This collaboration link does not exist.' : 'Could not load this collaboration link.');
          }
          const data = (await response.json()) as CollaborationLoadResponse;
          if (!cancelled) {
            setLinkData(data);
            setErrorMessage('');
          }
        } catch (err) {
          if (!cancelled) {
            setErrorMessage(err instanceof Error ? err.message : 'Could not load this collaboration link.');
            setLinkData(null);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      void load();
      return () => {
        cancelled = true;
      };
    }, [code]);

    return (
      <SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}>
        <motion.section className="min-h-[70vh] p-6 sm:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="max-w-3xl mx-auto glass-panel rounded-3xl p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/75 mb-2">Collaboration Link</p>
            <h1 className="brand-title text-3xl sm:text-4xl mb-3">Shared ARcane Session</h1>

            {loading ? (
              <p className="text-slate-300">Loading collaboration session...</p>
            ) : errorMessage ? (
              <p className="text-rose-300">{errorMessage}</p>
            ) : linkData ? (
              <div className="space-y-4">
                <p className="text-slate-200">Code: <span className="text-cyan-200">{linkData.code}</span></p>
                <p className="text-slate-300 text-sm">
                  {linkData.expiresAt ? `Expires ${new Date(linkData.expiresAt).toLocaleString()}` : 'No expiration date available.'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="arcane-btn arcane-btn-primary"
                    type="button"
                    onClick={() => {
                      if (!linkData.session) return;
                      applyIncomingSession(linkData.session);
                      setActiveCollabCode(linkData.code.toUpperCase());
                      setShareLink(`${window.location.origin}/collab/${linkData.code.toUpperCase()}`);
                      navigate(`/studio?collab=${linkData.code.toUpperCase()}`);
                      showToast('Collaboration session imported.', 'success');
                    }}
                  >
                    Open In Studio
                  </button>
                  <button className="arcane-btn arcane-btn-ghost" type="button" onClick={() => navigate('/studio')}>
                    Go To Studio
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-300">No collaboration data found.</p>
            )}
          </div>
        </motion.section>
      </SiteChrome>
    );
  };

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
          <Route path="/collaboration" element={<CollaborationHubPage />} />
          <Route path="/signup" element={<SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}><AuthPage initialMode="signup" /></SiteChrome>} />
          <Route path="/login" element={<SiteChrome theme={theme} onToggleTheme={onToggleTheme} authProfile={authProfile}><AuthPage initialMode="login" /></SiteChrome>} />
          <Route path="/collab/:code" element={<CollaborationLinkPage />} />
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
                      <div className="space-y-6">
                        <div className="glass-panel rounded-2xl p-6">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <h3 className="text-lg font-semibold">Session History</h3>
                            <button className="arcane-btn arcane-btn-ghost" type="button" onClick={clearStudioSession}>Clear Session</button>
                          </div>
                          {activeCollabCode && (
                            <p className="text-xs mb-4 text-slate-300">
                              Live room: <span className="text-cyan-200">{activeCollabCode}</span> ·
                              {' '}
                              <span className={collabStatus === 'live' ? 'text-emerald-300' : collabStatus === 'connecting' ? 'text-amber-300' : 'text-slate-400'}>
                                {collabStatus === 'live' ? 'Connected' : collabStatus === 'connecting' ? 'Connecting...' : 'Idle'}
                              </span>
                            </p>
                          )}

                          {!visibleHistory.length ? (
                            <p className="text-slate-300 text-sm">No history yet. Generate an image to start autosave and version tracking.</p>
                          ) : (
                            <div className="space-y-3 max-h-[340px] overflow-auto pr-1">
                              {visibleHistory.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 border border-white/10 rounded-xl p-2">
                                  {item.base64 ? (
                                    <img
                                      src={`data:image/png;base64,${item.base64}`}
                                      alt="History thumbnail"
                                      className="w-16 h-16 rounded-lg object-cover border border-white/10"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 rounded-lg border border-white/10 bg-slate-900/60 grid place-items-center text-[10px] text-slate-400 text-center px-1">
                                      DB Entry
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-100 truncate">{item.prompt}</p>
                                    <p className="text-xs text-slate-400">{item.timestamp.toLocaleString()}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button className="arcane-btn arcane-btn-ghost" type="button" onClick={() => { setCurrentImage(item); emitCollabActivity('opened a history item'); }} disabled={!item.base64}>Open</button>
                                    <button className="arcane-btn arcane-btn-ghost" type="button" onClick={() => { setCompareSelection((prev) => ({ ...prev, left: item.id })); emitCollabActivity('set compare A'); }}>A</button>
                                    <button className="arcane-btn arcane-btn-ghost" type="button" onClick={() => { setCompareSelection((prev) => ({ ...prev, right: item.id })); emitCollabActivity('set compare B'); }}>B</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {activeCollabCode && (
                          <div className="glass-panel rounded-2xl p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                              <h3 className="text-lg font-semibold">Live Activity</h3>
                              <p className="text-xs text-slate-400">Realtime peer actions</p>
                            </div>
                            {!collabActivities.length ? (
                              <p className="text-sm text-slate-300">No activity yet in this room.</p>
                            ) : (
                              <div className="space-y-2 max-h-52 overflow-auto pr-1">
                                {collabActivities.map((activity) => (
                                  <div key={activity.id} className="border border-white/10 rounded-xl p-2 bg-black/20">
                                    <p className="text-sm text-slate-100">{activity.actor ? `${activity.actor} ${activity.text}` : activity.text}</p>
                                    <p className="text-xs text-slate-400">{new Date(activity.timestamp).toLocaleTimeString()}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="glass-panel rounded-2xl p-6">
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <h3 className="text-lg font-semibold">Compare</h3>
                            <p className="text-xs text-slate-400">Select A and B from history</p>
                          </div>
                          {isCompareReady && compareLeft && compareRight ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {[compareLeft, compareRight].map((image, idx) => (
                                <div key={image.id} className="border border-white/10 rounded-xl p-3 bg-black/20">
                                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80 mb-2">{idx === 0 ? 'Version A' : 'Version B'}</p>
                                  {image.base64 ? (
                                    <img src={`data:image/png;base64,${image.base64}`} alt={`Compare ${idx === 0 ? 'A' : 'B'}`} className="w-full h-auto rounded-lg border border-white/10" />
                                  ) : (
                                    <div className="w-full min-h-48 rounded-lg border border-white/10 bg-slate-900/60 grid place-items-center text-slate-400 text-sm">
                                      Image data not available in DB entry
                                    </div>
                                  )}
                                  <p className="text-xs text-slate-300 mt-2 line-clamp-2">{image.prompt}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-300">Pick two different history entries using A and B to compare outputs.</p>
                          )}
                        </div>

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