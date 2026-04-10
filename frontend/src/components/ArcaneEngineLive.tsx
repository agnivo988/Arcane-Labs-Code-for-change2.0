import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGeminiImage } from '../hooks/useGeminiImage';
import { useCameraStream } from '../hooks/useCameraStream';
import { useWanAnimate } from '../hooks/useWanAnimate';

interface ArcaneEngineLiveProps {
  apiKey: string;
  onBackToStudio: () => void;
}

const ArcaneEngineLive: React.FC<ArcaneEngineLiveProps> = ({ apiKey, onBackToStudio }) => {
  const [mode, setMode] = useState<'transform' | 'wan'>('transform');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [processedFrame, setProcessedFrame] = useState<string | null>(null);
  const [wanPrompt, setWanPrompt] = useState('');
  const [wanPreviewUrl, setWanPreviewUrl] = useState('');
  const [wanDuration, setWanDuration] = useState(4);
  const [wanFps, setWanFps] = useState(24);
  const [wanLiveSync, setWanLiveSync] = useState(false);
  const [wanStatus, setWanStatus] = useState('Idle');
  const [error, setError] = useState<string | null>(null);
  const liveSyncInFlightRef = useRef(false);
  const wanMediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const { editImage } = useGeminiImage(apiKey);
  const { generateVideo, isGenerating: isWanGenerating, error: wanError, clearError: clearWanError } = useWanAnimate();
  const { 
    videoRef, 
    canvasRef, 
    isStreaming, 
    startCamera, 
    stopCamera, 
    captureFrame,
    getStream
  } = useCameraStream();

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (wanError) {
      setError(wanError);
    }
  }, [wanError]);

  const getWanFrame = useCallback(() => {
    return captureFrame();
  }, [captureFrame]);

  const captureWanVideo = useCallback(async (durationMs: number): Promise<string> => {
    const stream = getStream();
    if (!stream) {
      throw new Error('Camera stream is not available for Wan Animate');
    }

    if (wanMediaRecorderRef.current?.state === 'recording') {
      wanMediaRecorderRef.current.stop();
      wanMediaRecorderRef.current = null;
    }

    return await new Promise<string>((resolve, reject) => {
      const chunks: BlobPart[] = [];
      let recorder: MediaRecorder;

      try {
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      } catch {
        try {
          recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Recording not supported in this browser'));
          return;
        }
      }

      wanMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onerror = () => {
        reject(new Error('Failed to capture Wan video clip'));
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          }
          resolve(btoa(binary));
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to encode Wan video clip'));
        }
      };

      recorder.start();
      window.setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, durationMs);
    });
  }, [getStream]);

  const renderWanClip = useCallback(async () => {
    if (!isStreaming || !wanPrompt.trim() || liveSyncInFlightRef.current) return;

    liveSyncInFlightRef.current = true;
    setIsProcessing(true);
    setLastCommand(`Wan 2.2 Animate: ${wanPrompt.trim()}`);
    setWanStatus('Rendering clip...');

    try {
      const frameBase64 = getWanFrame();
      const videoBase64 = await captureWanVideo(Math.max(2000, wanDuration * 1000));

      if (!frameBase64 || !videoBase64) {
        throw new Error('Could not capture camera media for Wan Animate');
      }

      const result = await generateVideo({
        prompt: wanPrompt.trim(),
        video: videoBase64,
        videoBase64,
        referenceVideo: videoBase64,
        durationSeconds: wanDuration,
        fps: wanFps,
        liveSync: wanLiveSync
      });

      const videoUrl = result.videoUrl || (result.videoBase64 ? `data:${result.mimeType};base64,${result.videoBase64}` : '');
      if (!videoUrl) {
        throw new Error('Wan Animate did not return a playable video');
      }

      setWanPreviewUrl(videoUrl);
      setWanStatus(wanLiveSync ? 'Live sync active' : 'Clip ready');
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to generate Wan Animate clip');
      setWanStatus('Idle');
    } finally {
      liveSyncInFlightRef.current = false;
      setIsProcessing(false);
    }
  }, [generateVideo, getWanFrame, isStreaming, wanDuration, wanFps, wanLiveSync, wanPrompt, handleError]);

  useEffect(() => {
    if (!wanLiveSync || mode !== 'wan' || !isStreaming || !wanPrompt.trim()) return;

    void renderWanClip();
    const interval = window.setInterval(() => {
      void renderWanClip();
    }, 7000);

    return () => window.clearInterval(interval);
  }, [mode, isStreaming, renderWanClip, wanLiveSync, wanPrompt]);

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
          {mode === 'transform' && processedFrame && (
            <div className="absolute inset-0 bg-black/90">
              <img
                src={`data:image/jpeg;base64,${processedFrame}`}
                alt="Arcane Engine transformed reality"
                className="w-full h-full object-cover opacity-85"
              />
            </div>
          )}

          {mode === 'wan' && wanPreviewUrl && (
            <div className="absolute inset-0 bg-black/90">
              <video
                key={wanPreviewUrl}
                src={wanPreviewUrl}
                autoPlay
                muted
                loop
                playsInline
                controls={false}
                className="w-full h-full object-cover opacity-90"
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
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('transform')}
                  className={`px-4 py-2 rounded-full border transition-colors ${mode === 'transform' ? 'bg-cyan-400 text-slate-950 border-cyan-300' : 'bg-slate-900/40 border-slate-200/20 text-slate-200'}`}
                >
                  Transform
                </button>
                <button
                  type="button"
                  onClick={() => setMode('wan')}
                  className={`px-4 py-2 rounded-full border transition-colors ${mode === 'wan' ? 'bg-emerald-400 text-slate-950 border-emerald-300' : 'bg-slate-900/40 border-slate-200/20 text-slate-200'}`}
                >
                  Wan 2.2 Animate
                </button>
              </div>
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
          {mode === 'transform' && isStreaming && (
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
          {mode === 'transform' && isStreaming && (
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
          {mode === 'transform' && lastCommand && isStreaming && (
            <div className="text-center mb-8">
              <div className="bg-cyan-600/20 backdrop-blur-sm border border-cyan-400/30 rounded-lg p-4">
                <p className="text-cyan-200 font-semibold">Active Directive:</p>
                <p className="text-white text-lg">{lastCommand}</p>
              </div>
            </div>
          )}

          {/* Clear Effects Button */}
          {mode === 'transform' && processedFrame && isStreaming && (
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

          {mode === 'wan' && (
            <div className="mt-12 bg-slate-900/60 rounded-3xl border border-emerald-300/20 p-6 max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Wan 2.2 Animate</h2>
                <p className="text-slate-300">Generate short animated clips from the live camera frame and keep syncing as the scene changes.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-slate-200 mb-2">Animation Prompt</label>
                  <textarea
                    value={wanPrompt}
                    onChange={(e) => setWanPrompt(e.target.value)}
                    placeholder="Describe the motion, style, and environment changes for Wan 2.2 Animate..."
                    className="w-full min-h-32 px-4 py-3 rounded-2xl bg-slate-900/70 border border-emerald-300/20 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-300/60"
                    disabled={isWanGenerating}
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">Duration (sec)</label>
                    <input
                      type="number"
                      min={2}
                      max={12}
                      value={wanDuration}
                      onChange={(e) => setWanDuration(Number(e.target.value) || 4)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-900/70 border border-emerald-300/20 text-white focus:outline-none focus:border-emerald-300/60"
                      disabled={isWanGenerating}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">FPS</label>
                    <input
                      type="number"
                      min={12}
                      max={60}
                      value={wanFps}
                      onChange={(e) => setWanFps(Number(e.target.value) || 24)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-900/70 border border-emerald-300/20 text-white focus:outline-none focus:border-emerald-300/60"
                      disabled={isWanGenerating}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-6 justify-center">
                <button
                  type="button"
                  onClick={() => void renderWanClip()}
                  disabled={!isStreaming || isWanGenerating || !wanPrompt.trim()}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 px-8 py-4 rounded-full font-semibold transition-colors"
                >
                  {isWanGenerating ? 'Generating...' : 'Generate Wan Clip'}
                </button>
                <button
                  type="button"
                  onClick={() => setWanLiveSync((prev) => !prev)}
                  disabled={!isStreaming || isWanGenerating}
                  className={`px-8 py-4 rounded-full font-semibold transition-colors border ${wanLiveSync ? 'bg-cyan-400 text-slate-950 border-cyan-300' : 'bg-slate-900/60 text-white border-cyan-300/30'}`}
                >
                  {wanLiveSync ? 'Stop Live Sync' : 'Start Live Sync'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWanPreviewUrl('');
                    setWanStatus('Idle');
                    clearWanError();
                  }}
                  className="px-8 py-4 rounded-full font-semibold transition-colors border border-white/15 bg-slate-900/50 text-white"
                >
                  Clear Clip
                </button>
              </div>

              <div className="text-center text-slate-300 mb-4">
                <p>{wanStatus}</p>
              </div>

              <div className="rounded-3xl overflow-hidden border border-emerald-300/20 bg-black/40 aspect-video flex items-center justify-center">
                {wanPreviewUrl ? (
                  <video src={wanPreviewUrl} autoPlay muted loop playsInline controls className="w-full h-full object-cover" />
                ) : (
                  <p className="text-slate-400 text-center px-6">Your Wan-generated clip will appear here after generation.</p>
                )}
              </div>
            </div>
          )}

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
      {mode === 'transform' && !apiKey && (
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
