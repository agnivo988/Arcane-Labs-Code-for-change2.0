# Arcane Backend

Express + MongoDB API for signup, login, and profile usage tracking.

## Endpoints
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me/usage`
- `GET /api/health`

## Env
Copy `.env.example` to `.env` and set `MONGODB_URI` and `JWT_SECRET`.

For Wan Animate, set:
- `WAVESPEED_API_KEY`
- `WAVESPEED_WAN_MODEL` (default: `wavespeed-ai/wan2.2-animate`)
- `WAVESPEED_ENABLE_SYNC_MODE` if your model supports sync mode

Legacy `WAN_ANIMATE_*` vars are still accepted for compatibility.
