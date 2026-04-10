import React from 'react';

type HeroMediaPanelProps = {
  caption: string;
  source: string;
  poster?: string;
};

const HeroMediaPanel: React.FC<HeroMediaPanelProps> = ({ caption, source, poster }) => (
  <div className="hero-video-panel">
    <video className="hero-video" autoPlay muted loop playsInline preload="metadata" {...(poster ? { poster } : {})}>
      <source src={source} type="video/mp4" />
    </video>
    <div className="hero-video-caption">
      <p>{caption}</p>
    </div>
  </div>
);

export default HeroMediaPanel;
