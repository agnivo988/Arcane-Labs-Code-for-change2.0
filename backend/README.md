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
