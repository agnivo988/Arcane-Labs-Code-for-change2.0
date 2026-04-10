import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGeminiImage } from '../hooks/useGeminiImage';
import { useCameraStream } from '../hooks/useCameraStream';

interface ArcaneEngineLiveProps {
  apiKey: string;
  onBackToStudio: () => void;
}

const ArcaneEngineLive: React.FC<ArcaneEngineLiveProps> = ({ apiKey, onBackToStudio }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [processedFrame, setProcessedFrame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { editImage } = useGeminiImage(apiKey);
  const { 
    videoRef, 
    canvasRef, 
    isStreaming, 
    startCamera, 
    stopCamera, 
    captureFrame
  } = useCameraStream();

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const processTextCommand = useCallback(async (command: string) => {
    if (!command.trim() || !isStreaming) return;
    
    setIsProcessing(true);
    setLastCommand(command);
    setCurrentInput(''); // Clear input after processing
    
    try {
      const frameBase64 = captureFrame();
      if (!frameBase64) {
        throw new Error('Could not capture camera frame');
      }

      let result: string;
      
      if (processedFrame) {
        // Edit existing processed frame
        result = await editImage(processedFrame, `Apply this transformation to the camera view: ${command}. Keep the scene realistic but transform it according to the instruction.`);
      } else {
        // Generate initial transformation
        result = await editImage(frameBase64, `Transform this camera view: ${command}. Make it look realistic and maintain the original perspective and lighting.`);
      }
      
      setProcessedFrame(result);
      
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to process command');
    } finally {
      setIsProcessing(false);
    }
  }, [captureFrame, processedFrame, editImage, isStreaming, handleError]);

  const handleSubmitCommand = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (currentInput.trim()) {
      processTextCommand(currentInput.trim());
    }
  }, [currentInput, processTextCommand]);

  const handleStartCamera = useCallback(() => {
    startCamera(handleError);
    clearError();
  }, [startCamera, handleError, clearError]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="h-screen text-white relative overflow-y-auto overflow-x-hidden bg-slate-950">
      {/* Scrollable Container */}
      <div className="min-h-[200vh]">
        
        {/* Camera View Section - Takes full viewport height */}
        <div className="h-screen relative">
          <video 
            ref={videoRef}
            autoPlay
            playsInline
            muted
            controls={false}
            className="w-full h-full object-cover"
            style={{ backgroundColor: '#000' }}
            onError={(e) => {
              console.error('Video element error:', e);
              handleError('Video playback failed');
            }}
            onLoadedData={() => {
              console.log('Video data loaded successfully');
            }}
          />
          <canvas ref={canvasRef} className="hidden" width="512" height="288" />
          
          {/* AI Processed Frame Overlay */}
          {processedFrame && (
            <div className="absolute inset-0 bg-black/90">
              <img
                src={`data:image/jpeg;base64,${processedFrame}`}
                alt="Arcane Engine transformed reality"
                className="w-full h-full object-cover opacity-85"
              />
            </div>
          )}

          {/* Header Overlay on Camera View */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-slate-950/95 to-transparent p-4">
            <div className="flex justify-start mb-3">
              <motion.button
                onClick={onBackToStudio}
                className="px-4 py-2 rounded-lg border border-slate-200/40 text-slate-100 bg-slate-900/40 hover:bg-slate-900/70 transition-colors"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Back To Studio
              </motion.button>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 via-emerald-300 to-lime-200 bg-clip-text text-transparent">
                Arcane Engine Live
              </h1>
              <p className="text-slate-200 text-sm">Cinematic realtime scene transformations</p>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 animate-bounce">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>

        {/* Controls Section - Scrollable area below camera */}
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950/35 to-slate-950 p-6">
          {/* Section Title */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Live Control Deck</h2>
            <p className="text-slate-300">Shape your environment with precision prompts</p>
          </div>

          {/* Camera Controls */}
          <div className="flex justify-center mb-8">
            {!isStreaming ? (
              <motion.button
                onClick={handleStartCamera}
                className="bg-gradient-to-r from-cyan-400 to-indigo-400 hover:from-cyan-300 hover:to-indigo-300 text-slate-950 px-12 py-6 rounded-full shadow-lg transition-colors font-bold text-xl flex items-center gap-4 border-2 border-cyan-100/40"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Start Lens
              </motion.button>
            ) : (
              <motion.button
                onClick={stopCamera}
                className="bg-rose-600 hover:bg-rose-500 text-white px-12 py-6 rounded-full shadow-lg transition-colors font-semibold text-xl flex items-center gap-4 border-2 border-rose-300/30"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Stop Lens
              </motion.button>
            )}
          </div>

          {/* Transform Input - Only show when camera is streaming */}
          {isStreaming && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4 text-center">Scene Directive</h3>
              <form onSubmit={handleSubmitCommand} className="flex gap-3">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder="Describe what Arcane Engine should render..."
                  className="flex-1 px-6 py-4 bg-slate-900/60 backdrop-blur-sm border-2 border-cyan-200/30 rounded-full text-white placeholder-slate-300 focus:outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/40 text-lg transition-all"
                  disabled={isProcessing}
                />
                <motion.button
                  type="submit"
                  disabled={isProcessing || !currentInput.trim()}
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 px-8 py-4 rounded-full transition-colors flex items-center justify-center min-w-[100px]"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                >
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </motion.button>
              </form>
            </div>
          )}

          {/* Sample Prompts - Only show when camera is streaming */}
          {isStreaming && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 text-center">Instant Looks</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Retro Futurist Loft", icon: "🏙️" },
                  { name: "Deep-Sea Bioluminescence", icon: "🌌" },
                  { name: "Snowbound Expedition", icon: "🧊" },
                  { name: "Orbital Observation Deck", icon: "🛰️" },
                  { name: "Ancient Ruin Sanctuary", icon: "🗿" },
                  { name: "Monsoon Lightning", icon: "⚡" },
                  { name: "Sunset Archipelago", icon: "🌅" },
                  { name: "Neo-Industrial", icon: "⚙️" }
                ].map((prompt, index) => (
                  <motion.button
                    key={index}
                    onClick={() => setCurrentInput(`Make it look like a ${prompt.name.toLowerCase()}`)}
                    className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 backdrop-blur-sm border border-cyan-200/20 text-white rounded-xl hover:bg-slate-800/70 transition-colors text-left"
                    disabled={isProcessing}
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-2xl">{prompt.icon}</span>
                    <span className="font-medium">{prompt.name}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Status Display */}
          {lastCommand && isStreaming && (
            <div className="text-center mb-8">
              <div className="bg-cyan-600/20 backdrop-blur-sm border border-cyan-400/30 rounded-lg p-4">
                <p className="text-cyan-200 font-semibold">Active Directive:</p>
                <p className="text-white text-lg">{lastCommand}</p>
              </div>
            </div>
          )}

          {/* Clear Effects Button */}
          {processedFrame && isStreaming && (
            <div className="text-center mb-8">
              <motion.button
                onClick={() => setProcessedFrame(null)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-8 py-4 rounded-full text-lg font-semibold transition-colors border-2 border-amber-200/30"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Clear Render Overlay
              </motion.button>
            </div>
          )}

          {/* Instructions */}
          <div className="text-center text-gray-400 max-w-md mx-auto">
            <p className="mb-2">📱 <strong>Scroll up</strong> to view full camera</p>
            <p>🎬 <strong>Scroll down</strong> to access control deck</p>
          </div>

        </div>

      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="bg-slate-900/80 border border-cyan-200/20 backdrop-blur-sm rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Arcane Engine is rendering...</p>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="absolute top-20 left-4 right-4 z-30">
          <div className="bg-red-600/90 backdrop-blur-sm text-white px-4 py-3 rounded-lg flex justify-between items-center">
            <span className="text-sm">{error}</span>
            <button
              onClick={clearError}
              className="text-white hover:text-gray-300 font-bold text-lg ml-2"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* API Key Required Modal */}
      {!apiKey && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900/90 border border-cyan-200/20 backdrop-blur-sm rounded-lg p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold mb-4">API Key Required</h3>
            <p className="text-slate-300 mb-4 text-sm">
              Please set your Gemini API key to use Arcane Engine Live.
            </p>
            <p className="text-gray-400 text-xs">
              Go to your browser settings and enter your API key.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArcaneEngineLive;
