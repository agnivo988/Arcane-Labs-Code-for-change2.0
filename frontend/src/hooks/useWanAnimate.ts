import { useCallback, useState } from 'react';

export interface WanAnimateRequest {
  prompt: string;
  video?: string | null;
  videoBase64?: string | null;
  referenceVideo?: string | null;
  durationSeconds?: number;
  fps?: number;
  seed?: number;
  liveSync?: boolean;
}

export interface WanAnimateResult {
  videoUrl: string | null;
  videoBase64: string | null;
  mimeType: string;
  raw: unknown;
}

const normalizeResult = (data: any): WanAnimateResult => {
  const videoUrl = data?.videoUrl || data?.output?.videoUrl || data?.result?.videoUrl || data?.data?.videoUrl || null;
  const videoBase64 = data?.videoBase64 || data?.output?.videoBase64 || data?.result?.videoBase64 || data?.data?.videoBase64 || null;
  const mimeType = data?.mimeType || data?.output?.mimeType || data?.result?.mimeType || data?.data?.mimeType || 'video/mp4';

  return {
    videoUrl,
    videoBase64,
    mimeType,
    raw: data
  };
};

const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || 'https://arcane-labs-code-for-change2-0.onrender.com';

export const useWanAnimate = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateVideo = useCallback(async (request: WanAnimateRequest): Promise<WanAnimateResult> => {
    const response = await fetch(`${BACKEND_ORIGIN}/api/wan/animate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...request,
        video: request.video || request.videoBase64 || request.referenceVideo || null
      })
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      throw new Error(typeof data === 'string' ? data : data?.message || 'Wan Animate request failed');
    }

    return normalizeResult(data);
  }, []);

  const runGeneration = useCallback(async (request: WanAnimateRequest): Promise<WanAnimateResult> => {
    setIsGenerating(true);
    setError(null);
    try {
      return await generateVideo(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate video';
      setError(message);
      throw new Error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [generateVideo]);

  return {
    generateVideo: runGeneration,
    isGenerating,
    error,
    clearError: () => setError(null)
  };
};
