import express from 'express';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import wavespeed from 'wavespeed';

const router = express.Router();

const hasProtocol = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

const stripDataUrlPrefix = (value) => {
  if (typeof value !== 'string') return { mimeType: 'video/webm', base64: value };

  const match = value.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) {
    return { mimeType: 'video/webm', base64: value };
  }

  return {
    mimeType: match[1] || 'video/webm',
    base64: match[2] || ''
  };
};

const mimeToExtension = (mimeType) => {
  if (mimeType === 'video/mp4') return '.mp4';
  if (mimeType === 'video/webm') return '.webm';
  if (mimeType === 'video/quicktime') return '.mov';
  return '.webm';
};

const resolveModelName = () => {
  const configuredModel = process.env.WAVESPEED_WAN_MODEL || process.env.WAN_ANIMATE_MODEL || 'wan2.2-animate';
  return configuredModel.includes('/') ? configuredModel : `wavespeed-ai/${configuredModel}`;
};

const uploadVideoInput = async (videoInput) => {
  if (!videoInput) {
    throw new Error('Wan Animate requires a video field.');
  }

  if (hasProtocol(videoInput)) {
    return videoInput;
  }

  const { mimeType, base64 } = stripDataUrlPrefix(videoInput);
  if (!base64) {
    throw new Error('Wan Animate video input is empty.');
  }

  const tempPath = path.join(os.tmpdir(), `wavespeed-wan-${Date.now()}-${Math.random().toString(36).slice(2)}${mimeToExtension(mimeType)}`);
  const buffer = Buffer.from(base64, 'base64');

  await fs.writeFile(tempPath, buffer);

  try {
    return await wavespeed.upload(tempPath);
  } finally {
    await fs.rm(tempPath, { force: true });
  }
};

const extractFirstOutput = (result) => {
  if (!result) return null;
  if (typeof result === 'string') return result;

  const candidates = [
    result.outputs,
    result.output,
    result.result,
    result.data
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') return candidate;
    if (Array.isArray(candidate) && candidate.length > 0) {
      const first = candidate[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') {
        return first.url || first.videoUrl || first.output || first.result || first.data || null;
      }
    }
    if (candidate && typeof candidate === 'object') {
      return candidate.url || candidate.videoUrl || candidate.output || candidate.result || candidate.data || null;
    }
  }

  return result.url || result.videoUrl || null;
};

router.post('/animate', async (req, res) => {
  try {
    const apiKey = process.env.WAVESPEED_API_KEY || process.env.WAN_ANIMATE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'WAVESPEED_API_KEY is not configured.' });
    }

    const model = resolveModelName();
    const timeoutMs = Number(process.env.WAVESPEED_TIMEOUT_MS || process.env.WAN_ANIMATE_TIMEOUT_MS || 120000);
    const enableSyncMode = String(process.env.WAVESPEED_ENABLE_SYNC_MODE || 'false').toLowerCase() === 'true';
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const videoInput = req.body?.video || req.body?.videoBase64 || req.body?.referenceVideo || null;
    const uploadedVideo = await uploadVideoInput(videoInput);

    const client = new wavespeed.Client(apiKey, {
      maxRetries: Number(process.env.WAVESPEED_MAX_RETRIES || 0),
      maxConnectionRetries: Number(process.env.WAVESPEED_MAX_CONNECTION_RETRIES || 5),
      retryInterval: Number(process.env.WAVESPEED_RETRY_INTERVAL || 1.0)
    });

    const result = await client.run(
      model,
      {
        ...req.body,
        prompt,
        video: uploadedVideo,
        videoBase64: undefined,
        referenceVideo: uploadedVideo
      },
      {
        timeout: Math.max(1, Math.ceil(timeoutMs / 1000)),
        pollInterval: Number(process.env.WAVESPEED_POLL_INTERVAL || 1.0),
        enableSyncMode
      }
    );

    const videoUrl = extractFirstOutput(result);
    const videoBase64 = typeof result?.videoBase64 === 'string' ? result.videoBase64 : null;

    return res.json({
      videoUrl,
      videoBase64,
      mimeType: result?.mimeType || 'video/mp4',
      raw: result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to call Wan Animate.';
    return res.status(500).json({ message });
  }
});

export default router;
