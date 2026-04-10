import React from 'react';
import { motion } from 'framer-motion';

interface ApiKeyInputProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ apiKey, onApiKeyChange }) => {
  return (
    <motion.div className="glass-panel rounded-2xl p-6" whileHover={{ y: -2 }}>
      <h2 className="text-xl font-semibold mb-4">Arcane Engine Configuration</h2>
      <div className="space-y-2">
        <label htmlFor="apiKey" className="block text-sm font-medium text-slate-200">
          Google Gemini API Key
        </label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="Enter your Gemini API key..."
          className="w-full px-4 py-2 bg-slate-900/70 border border-cyan-200/20 rounded-xl focus:ring-2 focus:ring-cyan-300/50 focus:border-cyan-300/50 text-white placeholder-slate-400 transition-all"
        />
        <p className="text-xs text-slate-400">
          Get your API key from{' '}
          <a
            href="https://makersuite.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 hover:text-cyan-200"
          >
            Google AI Studio
          </a>
        </p>
      </div>
    </motion.div>
  );
};

export default ApiKeyInput;
