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

For Google Meet scheduling, set:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID` if you want to use a calendar other than `primary`
- `GOOGLE_REDIRECT_URI` if your OAuth flow requires a custom redirect URI

For the RTC handoff link, optionally set:
- `RTC_PROVIDER_NAME`
- `RTC_JOIN_URL_TEMPLATE` using `{sessionId}` as the placeholder

For attendee email notifications, set:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE` (`true` or `false`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
