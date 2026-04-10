import express from 'express';

const router = express.Router();

router.post('/animate', async (req, res) => {
  try {
    const targetUrl = process.env.WAN_ANIMATE_API_URL;
    if (!targetUrl) {
      return res.status(500).json({ message: 'WAN_ANIMATE_API_URL is not configured.' });
    }

    const apiKey = process.env.WAN_ANIMATE_API_KEY;
    const model = process.env.WAN_ANIMATE_MODEL || 'wan2.2-animate';
    const timeoutMs = Number(process.env.WAN_ANIMATE_TIMEOUT_MS || 120000);
    const video = req.body?.video || req.body?.videoBase64 || req.body?.referenceVideo || null;

    if (!video) {
      return res.status(400).json({ message: 'Wan Animate requires a video field.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
          Accept: 'application/json'
        },
        body: JSON.stringify({
          model,
          ...req.body,
          video,
          prompt: req.body?.prompt || ''
        }),
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return res.status(response.status).json(data);
      }

      const text = await response.text();
      return res.status(response.status).send(text);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Wan Animate request timed out.'
      : error instanceof Error
        ? error.message
        : 'Failed to call Wan Animate.';
    return res.status(500).json({ message });
  }
});

export default router;
