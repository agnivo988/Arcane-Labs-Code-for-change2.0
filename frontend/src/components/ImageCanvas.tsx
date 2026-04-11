import React from 'react';
import { motion } from 'framer-motion';

interface GeneratedImage {
  id: string;
  base64: string;
  prompt: string;
  timestamp: Date;
}

interface ImageCanvasProps {
  image: GeneratedImage | null;
  isLoading: boolean;
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({ image, isLoading }) => {
  const normalizeBase64 = (value?: string | null) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:image/')) {
      const split = trimmed.split(',');
      return split.length > 1 ? split[1].trim() : '';
    }
    return trimmed;
  };

  const toImageSrc = (value?: string | null) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:image/')) return trimmed;
    const normalized = normalizeBase64(trimmed);
    if (!normalized) return '';
    const mime = normalized.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${normalized}`;
  };

  const imageSrc = image ? toImageSrc(image.base64) : '';

  const downloadImage = () => {
    if (!image) return;
    
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `arcane-engine-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="glass-panel rounded-2xl p-8">
        <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-cyan-200/20 rounded-xl">
          <div className="w-full space-y-4 px-6">
            <div className="h-12 rounded-xl bg-slate-800/70 skeleton-shimmer" />
            <div className="h-56 rounded-xl bg-slate-800/60 skeleton-shimmer" />
            <div className="h-4 w-2/3 rounded bg-slate-800/60 skeleton-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="glass-panel rounded-2xl p-8">
        <div className="canvas-empty flex flex-col items-center justify-center h-96 rounded-xl">
          <div className="canvas-empty-orb mb-5" />
          <h3 className="text-xl font-semibold text-slate-100 mb-2">Your Generated Frame Appears Here</h3>
          <p className="text-slate-300 text-center max-w-sm">
            Write a precise prompt and run Generate, Edit, or Fuse to render the output canvas.
          </p>
        </div>
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div className="glass-panel rounded-2xl p-8">
        <div className="canvas-empty flex flex-col items-center justify-center h-96 rounded-xl">
          <h3 className="text-xl font-semibold text-slate-100 mb-2">Image Could Not Be Rendered</h3>
          <p className="text-slate-300 text-center max-w-sm">
            The generation returned an unsupported image payload. Try generating again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div className="glass-panel rounded-2xl p-6" whileHover={{ y: -2 }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Generated Image</h3>
        <motion.button
          onClick={downloadImage}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-xl transition-colors"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Download
        </motion.button>
      </div>
      
      <div className="space-y-4">
        <motion.div className="relative group overflow-hidden rounded-xl" whileHover={{ scale: 1.01 }}>
          <img
            src={imageSrc}
            alt="Generated image"
            className="w-full h-auto rounded-xl border border-cyan-200/20"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
            <button
              onClick={downloadImage}
              className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white font-medium rounded-lg"
            >
              Click to Download
            </button>
          </div>
        </motion.div>
        
        <div className="text-sm space-y-2">
          <div>
            <span className="text-slate-400">Prompt:</span>
            <p className="text-white mt-1">{image.prompt}</p>
          </div>
          <div>
            <span className="text-slate-400">Generated:</span>
            <p className="text-white">{image.timestamp.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ImageCanvas;
