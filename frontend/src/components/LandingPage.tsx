import React, { useEffect, useRef } from 'react';

interface LandingPageProps {
  onEnterStudio: () => void;
  onEnterLive: () => void;
  hasApiKey: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnterStudio, onEnterLive, hasApiKey }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const elements = Array.from(root.querySelectorAll<HTMLElement>('.reveal-on-scroll'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="landing-shell landing-editorial text-slate-100">
      <nav className="landing-topbar fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-5 md:py-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-cyan-200/90">✦</span>
            <span className="landing-serif text-2xl tracking-tight text-[#e9c176]">ATELIER</span>
          </div>
          <div className="hidden md:flex items-center gap-10 text-[11px] uppercase tracking-[0.2em] text-slate-300/70">
            <a href="#manifesto" className="hover:text-[#e9c176] transition-colors">The Manifesto</a>
            <a href="#instruments" className="hover:text-[#e9c176] transition-colors">Creative Residency</a>
            <a href="#archive" className="hover:text-[#e9c176] transition-colors">Technical Archive</a>
          </div>
          <button
            onClick={onEnterStudio}
            className="bg-[#e9c176] text-[#412d00] px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Enter Studio
          </button>
        </div>
      </nav>

      <main>
        <section className="relative min-h-screen pt-24 flex items-center justify-center overflow-hidden landing-hero-gradient">
          <div className="absolute inset-0 opacity-25 pointer-events-none">
            <div className="absolute top-1/4 -right-20 w-96 h-96 bg-[#bbc6e2]/20 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-[#e9c176]/10 rounded-full blur-[120px]"></div>
          </div>
          <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10 text-center reveal-on-scroll is-visible">
            <p className="text-[11px] uppercase tracking-[0.4em] text-[#e9c176] mb-8">The Aetheris Collection</p>
            <h1 className="landing-serif italic text-5xl md:text-8xl leading-tight tracking-tight mb-10">
              Design Worlds
              <span className="block text-[#bbc6e2]">In Real Time</span>
            </h1>
            <p className="text-base md:text-xl text-slate-300 max-w-2xl mx-auto font-light leading-relaxed mb-12">
              Arcane Engine is a digital atelier for modern creators, where AI acts as a refined medium,
              not a substitute for vision.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
              <button
                onClick={onEnterStudio}
                className="bg-[#e9c176] text-[#412d00] px-10 py-4 rounded-xl text-lg font-medium hover:opacity-90 transition-opacity"
              >
                Enter Main Studio
              </button>
              <button
                onClick={onEnterLive}
                className="border border-slate-500/50 px-10 py-4 rounded-xl text-lg font-medium hover:bg-white/5 transition-colors"
              >
                Open Live Engine
              </button>
            </div>
            {!hasApiKey && (
              <p className="text-amber-300/90 text-sm mt-5">Live mode requires an API key. Add it in the main studio.</p>
            )}
          </div>
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-45">
            <span className="text-[10px] uppercase tracking-[0.3em]">Scroll To Explore</span>
            <div className="w-[1px] h-12 bg-gradient-to-b from-[#e9c176] to-transparent"></div>
          </div>
        </section>

        <section id="instruments" className="py-24 px-6 md:px-12 bg-[#121416]">
          <div className="max-w-7xl mx-auto">
            <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 reveal-on-scroll">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#bbc6e2]/60 mb-4">The Suite</p>
                <h2 className="landing-serif italic text-5xl md:text-7xl">The Studio Instruments</h2>
              </div>
              <p className="text-slate-400 max-w-sm text-sm leading-relaxed">
                Precision modules designed for high-fidelity translation of thought into visual form.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <article className="md:col-span-8 reveal-on-scroll rounded-xl overflow-hidden relative bg-[#1a1c1e] min-h-[380px] md:min-h-[520px]">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBkDHjOLi6qdcwT1VFBNIgiPHD9vbJbETukFOSkvmSNQJMBFZxtHeqaPKvhTPFKld13_wmME8iKxxIqf5lbFdFyKvtVGX81ZeahfwEXpnSXIuFfr4vdsC1IkyebYyPEBt4v8Ug10U1G_vm7XAvShYx4eFBrbUBQ1Tgtmma_UZ7-f2l7Ri_I331t1I9xTgqtwW9UXRgYd8244gWDd9e_t86U7MBQfsrj-rXYoIbMNA0oqLDJ237_rhXXYZImprVQAdWbWxQd4FOF4Cw"
                  alt="Arcane live lens"
                  className="absolute inset-0 w-full h-full object-cover opacity-60 hover:scale-105 transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e10] via-transparent to-transparent"></div>
                <div className="absolute bottom-0 p-8 md:p-12">
                  <p className="text-[#e9c176] mb-4">✦</p>
                  <h3 className="landing-serif text-3xl md:text-4xl mb-3">Arcane Live Lens</h3>
                  <p className="text-slate-300 max-w-lg text-sm leading-relaxed">
                    Experience immediate visual feedback while your concepts evolve in realtime.
                  </p>
                </div>
              </article>

              <article className="md:col-span-4 reveal-on-scroll rounded-xl overflow-hidden relative bg-[#1a1c1e] min-h-[520px]" style={{ transitionDelay: '100ms' }}>
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCas5FMbkob2hJq6f5lY0J9NyWLBIfwfcI33vrlNiRzfb4ixhvpC4QeDcghOG7u13bpd6AU8A0f7OB8usL9oM7Oy5dYp_z5J6ADB9NpAJzrf-ujl11Hm0jpeLc8skLE6SIbMtPuhihsDdLFzAcDssWVaf2PVaN_u1JINT8JSdFJEhuDeQ96aUiM3VgoRdkSH20QjpPgrbqhHJrNeF0VdqX6B4Kd8sqh9JYyrcNIYm43ml7ApXvj5GT0SX8CKACKl4eVKc-stDuK_v8"
                  alt="Prompt forge"
                  className="absolute inset-0 w-full h-full object-cover opacity-40"
                />
                <div className="absolute inset-0 bg-[#0f1a2e]/35"></div>
                <div className="absolute inset-0 p-8 md:p-10 flex flex-col justify-between">
                  <div>
                    <p className="text-[#bbc6e2] mb-4">✎</p>
                    <h3 className="landing-serif text-3xl mb-3">Prompt Forge</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Refine raw intent into articulate high-fidelity visual direction.
                    </p>
                  </div>
                  <div className="bg-[#333537]/60 backdrop-blur-xl p-5 rounded-xl border border-white/10">
                    <div className="w-full h-1 bg-white/10 rounded-full mb-3">
                      <div className="w-2/3 h-full bg-[#e9c176] rounded-full"></div>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#e9c176]">Refining Semantic Clarity</p>
                  </div>
                </div>
              </article>

              <article className="md:col-span-12 reveal-on-scroll rounded-xl overflow-hidden bg-[#1a1c1e]" style={{ transitionDelay: '140ms' }}>
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="p-8 md:p-12 flex flex-col justify-center">
                    <p className="text-[#e9c176] mb-4">◈</p>
                    <h3 className="landing-serif text-3xl md:text-4xl mb-3">Image Fusion Deck</h3>
                    <p className="text-slate-300 text-sm max-w-sm leading-relaxed">
                      Seamlessly weave visual threads into a cohesive, editorial-grade composition.
                    </p>
                  </div>
                  <div className="min-h-[220px] md:min-h-[320px]">
                    <img
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDzWD856xHGy9iRmffVOnlKvlE52yy4jA6osrk0jvzL6joJB1T46-nC9_Pyp-5gFKeweUlFguuNkOael5Ucaq_VGnT2Eq8dSlnDOuFxhg5KrAh33sCKC92UJAM2P9MfrZ-ggKd8fuf6U4tcIR_DDByDfnvIAT3fPEutgRtsM2RkySqPxo_tDNyLCHEyiXW4aSGB7KF-juvo2kkDGI10QyVm8Xw3PABwc0AZJOlT5V0maR5P30s1S7b-ce-BkybwVDRzI_nlRt7HqNQ"
                      alt="Fusion deck"
                      className="w-full h-full object-cover opacity-70"
                    />
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="manifesto" className="py-28 md:py-40 px-6 md:px-12 bg-[#1a1c1e] text-center reveal-on-scroll">
          <div className="max-w-5xl mx-auto">
            <p className="text-3xl text-[#e9c176]/50 mb-8">”</p>
            <blockquote className="landing-serif italic text-3xl md:text-6xl leading-tight mb-8">
              AI is not the architect of the future; it is the fine-tipped brush in the hands of those who dare to dream of invisible details.
            </blockquote>
            <cite className="text-[11px] not-italic uppercase tracking-[0.35em] text-slate-400">The Arcane Manifesto</cite>
          </div>
        </section>

        <section id="archive" className="py-24 px-6 md:px-12 bg-[#121416]">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="reveal-on-scroll landing-glass p-4 rounded-xl">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBsjPkLsPfv9C70R2pDjscdZme-YvLa5gyrZZ6ECM6zJp3dFkxoVyoqCKWgwX8iynqfgWs9pyj2oxOk8SpWdergStCK5i3TVMVVM3vc-CsEAU_2vneRVEWcAEZxjmHMBuAsnkxVknLniJTSRDv86Br-8xJZnFpesZlX9VMBw3xqhF0HFqhqh--CJIosEYzzu2CZKJJrKQ4hOqDjQvRRCekFi8Xv5jwUePcsqwnsoAsJLtYtPcdDSviik0lf9DpldMnf-4KcTSgsWWw"
                alt="Crafting invisible detail"
                className="w-full h-[420px] md:h-[560px] object-cover rounded-lg grayscale hover:grayscale-0 transition-all duration-1000"
              />
            </div>
            <div className="reveal-on-scroll" style={{ transitionDelay: '120ms' }}>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#bbc6e2] mb-5">Editorial Archive Vol. I</p>
              <h2 className="landing-serif italic text-5xl md:text-7xl leading-tight mb-6">Crafting the Invisible Detail</h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                In a world of instant outputs, luxury lies in the intentional nuance: the grain, the glow,
                and the subtle visual friction that makes digital worlds feel authored.
              </p>
              <p className="text-slate-400 leading-relaxed mb-10">
                Arcane Engine amplifies your point of view, ensuring each composition carries the unmistakable
                signature of its creator.
              </p>
              <div className="flex items-center gap-6">
                <button
                  onClick={onEnterStudio}
                  className="text-[#e9c176] uppercase tracking-[0.2em] text-xs hover:tracking-[0.28em] transition-all"
                >
                  Go To Main Page
                </button>
                <div className="h-px w-16 bg-white/15"></div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 px-6 md:px-12 bg-[#121416]">
          <div className="max-w-7xl mx-auto landing-glass rounded-xl p-10 md:p-16 text-center reveal-on-scroll">
            <h2 className="landing-serif italic text-5xl md:text-7xl mb-8">The Canvas Awaits.</h2>
            <p className="text-slate-300 max-w-2xl mx-auto mb-10 text-lg">
              Begin in the Arcane Studio and continue into the live engine for immersive realtime transformation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onEnterStudio}
                className="bg-[#e9c176] text-[#412d00] px-10 py-4 rounded-xl text-lg font-medium hover:scale-105 transition-transform"
              >
                Apply For Residency
              </button>
              <button
                onClick={onEnterLive}
                className="border border-slate-400/40 px-10 py-4 rounded-xl text-lg font-medium hover:bg-white/5 transition-colors"
              >
                Start Live Mode
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full py-16 px-6 md:px-12 border-t border-white/10 bg-[#121416]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-end">
          <div>
            <div className="landing-serif text-xl italic text-[#e9c176] mb-5">ATELIER</div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#bbc6e2]">
              © 2026 Arcane Engine. Crafted for the discerning creator.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4 md:justify-end text-[11px] uppercase tracking-[0.2em] text-[#bbc6e2]/45">
            <a href="#manifesto" className="hover:text-[#e9c176] transition-colors">The Manifesto</a>
            <a href="#instruments" className="hover:text-[#e9c176] transition-colors">Creative Residency</a>
            <a href="#archive" className="hover:text-[#e9c176] transition-colors">Technical Archive</a>
            <button onClick={onEnterStudio} className="hover:text-[#e9c176] transition-colors">Main Studio</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
