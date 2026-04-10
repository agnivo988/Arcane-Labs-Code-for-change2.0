import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface PromptFormProps {
  onGenerate: (prompt: string) => void;
  onEdit: (prompt: string) => void;
  onFuse: (prompt: string) => void;
  isLoading: boolean;
  hasImage: boolean;
  hasUploadedImages: boolean;
}

const PromptForm: React.FC<PromptFormProps> = ({
  onGenerate,
  onEdit,
  onFuse,
  isLoading,
  hasImage,
  hasUploadedImages
}) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (action: 'generate' | 'edit' | 'fuse') => {
    if (!prompt.trim()) return;
    
    switch (action) {
      case 'generate':
        onGenerate(prompt);
        break;
      case 'edit':
        onEdit(prompt);
        break;
      case 'fuse':
        onFuse(prompt);
        break;
    }
    
    setPrompt('');
  };

  return (
    <motion.div className="glass-panel rounded-2xl p-6" whileHover={{ y: -2 }}>
      <h3 className="text-lg font-semibold mb-4">Creative Prompt Console</h3>
      <div className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what Arcane Engine should generate, edit, or fuse..."
          className="w-full px-4 py-3 bg-slate-900/70 border border-cyan-200/20 rounded-xl focus:ring-2 focus:ring-cyan-300/50 focus:border-cyan-300/50 text-white placeholder-slate-400 resize-none transition-all"
          rows={3}
          disabled={isLoading}
        />
        
        <div className="flex flex-wrap gap-3">
          <motion.button
            onClick={() => handleSubmit('generate')}
            disabled={isLoading || !prompt.trim()}
            className="flex-1 min-w-[120px] px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-xl transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </motion.button>
          
          <motion.button
            onClick={() => handleSubmit('edit')}
            disabled={isLoading || !prompt.trim() || !hasImage}
            className="flex-1 min-w-[120px] px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-xl transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {isLoading ? 'Editing...' : 'Edit Image'}
          </motion.button>
          
          <motion.button
            onClick={() => handleSubmit('fuse')}
            disabled={isLoading || !prompt.trim() || !hasUploadedImages}
            className="flex-1 min-w-[120px] px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-xl transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {isLoading ? 'Fusing...' : 'Fuse Images'}
          </motion.button>
        </div>
        
        <div className="text-sm text-slate-300/90 space-y-1">
          <p>• <strong>Generate:</strong> Create a new image from your prompt</p>
          <p>• <strong>Edit:</strong> Modify the current image {!hasImage && '(generate an image first)'}</p>
          <p>• <strong>Fuse:</strong> Combine uploaded images {!hasUploadedImages && '(upload two images first)'}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default PromptForm;
