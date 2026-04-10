import React, { useEffect, useRef } from 'react';

type ImmersiveLoaderProps = {
  done: boolean;
  progress: number;
};

const PARTICLE_COUNT = 22000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ImmersiveLoader: React.FC<ImmersiveLoaderProps> = ({ done, progress }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
    const reduceMotion = reduceMotionQuery.matches;
    const enablePointerAttractor = !reduceMotion && !coarsePointerQuery.matches;

    const px = new Float32Array(PARTICLE_COUNT);
    const py = new Float32Array(PARTICLE_COUNT);
    const pz = new Float32Array(PARTICLE_COUNT);
    const vx = new Float32Array(PARTICLE_COUNT);
    const vy = new Float32Array(PARTICLE_COUNT);
    const vz = new Float32Array(PARTICLE_COUNT);
    const seed = new Float32Array(PARTICLE_COUNT);

    let width = 1;
    let height = 1;
    let halfW = 0.5;
    let halfH = 0.5;
    let raf = 0;
    let lastT = performance.now();
    let time = 0;
    let attractX = 0;
    let attractY = 0;

    const resize = () => {
      const dpr = clamp(window.devicePixelRatio || 1, 1, 1.8);
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      halfW = width * 0.5;
      halfH = height * 0.5;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resetParticles = () => {
      const radiusBase = Math.min(width, height) * 0.28;
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const t = i + 0.5;
        const r = radiusBase * Math.sqrt(t / PARTICLE_COUNT);
        const angle = t * GOLDEN_ANGLE;
        const depth = ((i % 240) / 240 - 0.5) * 2.2;
        px[i] = Math.cos(angle) * r;
        py[i] = Math.sin(angle) * r;
        pz[i] = depth;
        vx[i] = 0;
        vy[i] = 0;
        vz[i] = 0;
        seed[i] = (i % 1024) / 1024;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      attractX = (event.clientX - halfW) / halfW;
      attractY = (event.clientY - halfH) / halfH;
    };

    const onMouseLeave = () => {
      attractX = 0;
      attractY = 0;
    };

    const render = (now: number) => {
      const dt = clamp((now - lastT) / 1000, 0.001, 0.035);
      lastT = now;
      time += dt;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(6, 8, 15, 0.12)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      const basinStrength = reduceMotion ? 0.14 : 0.22;
      const attractStrength = enablePointerAttractor ? 0.15 : 0;
      const ripplePhase = time * 0.7;
      const cam = 2.2;

      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const sx = px[i];
        const sy = py[i];
        const sz = pz[i];
        const dist = Math.hypot(sx, sy) + 1e-5;
        const nx = sx / dist;
        const ny = sy / dist;
        const ringWave = Math.sin(dist * 0.019 - ripplePhase + seed[i] * 6.2831);
        const interference = Math.cos((sx + sy) * 0.005 + time * 1.8 + seed[i] * 12.0);
        const basinPull = -dist * 0.0016;

        const ax = nx * (basinPull + ringWave * 0.014) + (-sy * 0.00038) + attractX * attractStrength * 0.8;
        const ay = ny * (basinPull + interference * 0.012) + (sx * 0.00038) + attractY * attractStrength * 0.8;
        const az = -sz * 0.03 + ringWave * 0.008 + interference * 0.006;

        vx[i] = (vx[i] + ax * basinStrength) * 0.985;
        vy[i] = (vy[i] + ay * basinStrength) * 0.985;
        vz[i] = (vz[i] + az * basinStrength) * 0.984;

        px[i] += vx[i] * 60 * dt;
        py[i] += vy[i] * 60 * dt;
        pz[i] = clamp(pz[i] + vz[i] * 45 * dt, -1.9, 1.9);

        const depth = (pz[i] + cam) / (cam + 2.5);
        const proj = 1 / (0.9 + pz[i] * 0.32);
        const rx = halfW + px[i] * proj;
        const ry = halfH + py[i] * proj;
        if (rx < -8 || rx > width + 8 || ry < -8 || ry > height + 8) continue;

        const hue = 184 + Math.sin(time * 0.5 + seed[i] * 9.0) * 34 + pz[i] * 16;
        const alpha = clamp(0.08 + depth * 0.58, 0.04, 0.75);
        const radius = clamp(0.45 + depth * 1.2, 0.4, 1.75);

        ctx.fillStyle = `hsla(${hue.toFixed(1)} 92% 72% / ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(rx, ry, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = window.requestAnimationFrame(render);
    };

    resize();
    resetParticles();
    lastT = performance.now();
    raf = window.requestAnimationFrame(render);
    window.addEventListener('resize', resize, { passive: true });
    if (enablePointerAttractor) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('mouseleave', onMouseLeave);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      if (enablePointerAttractor) {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseleave', onMouseLeave);
      }
    };
  }, []);

  return (
    <div className={`loader-shell ${done ? 'is-exiting' : ''}`}>
      <canvas ref={canvasRef} className="loader-canvas" aria-hidden="true" />
      <div className="loader-vignette" aria-hidden="true" />
      <div className="loader-hud">
        <p className="loader-logo"><span>ARcane</span><em>Engine</em></p>
        <p className="loader-tagline">Realtime Visual Computing Surface</p>
        <div className="loader-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ transform: `scaleX(${clamp(progress, 0, 1)})` }} />
        </div>
        <p className="loader-labs">ARcane Labs · 2026</p>
      </div>
    </div>
  );
};

export default ImmersiveLoader;
