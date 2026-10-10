# Prodigy FS 01 - Secure Authentication App

A full-stack authentication application built with a FastAPI backend and a React frontend. It implements secure registration, login, JWT-based session handling, refresh-token rotation, protected user routes, profile update support, and logout revocation.

## Tech Stack

- Backend: FastAPI, SQLAlchemy, PostgreSQL, JWT, Passlib + Argon2
- Frontend: React, Vite, React Router
- Testing: pytest for backend and Vitest for frontend

## Project Structure

- `backend/` – FastAPI application and API logic
- `frontend/` – React client and protected route UI
- `docker-compose.yml` – PostgreSQL local database
- `.env.example` – environment configuration template

## Features

- Secure user registration with email/password validation
- Password hashing using Argon2
- Short-lived access tokens and rotating refresh tokens
- Logout revocation of active tokens
- Protected API routes using authenticated user checks
- Profile fetch and profile update endpoints
- Frontend protected routes and auth state management
- Local PostgreSQL setup using Docker

## Local Setup

### 1. Clone and open the repository

```bash
git clone <repo-url>
cd PRODIGY_FS_01
```

### 2. Create backend environment

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy the sample env file and adjust values if necessary:

```bash
copy .env.example .env
```

The defaults in `.env.example` are suitable for local development with Docker Compose.

### 4. Start PostgreSQL

```bash
docker compose up -d db
```

### 5. Run the backend

```bash
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Run the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open the frontend URL shown by Vite, usually:

```text
http://localhost:5173
```

## Testing

### Backend tests

```bash
cd backend
.venv\Scripts\activate
pytest -q
```

### Frontend tests

```bash
cd frontend
npm test -- --run
```

### Production build check

```bash
cd frontend
npm run build
```

## Security Notes

- Passwords are never returned in API responses.
- Access tokens are validated against revocation records.
- Refresh tokens are rotated on refresh to reduce replay risk.
- Protected routes reject requests using revoked or expired JWTs.
- CORS is restricted to the frontend origin configured in environment settings.

## Important Files

- `backend/app/api/auth.py` – authentication endpoints
- `backend/app/services/auth.py` – JWT, hashing, revocation, and session logic
- `backend/app/models/user.py` – database models
- `backend/app/schemas/user.py` – request/response validation schemas
- `frontend/src/App.jsx` – route and protected-route definitions
- `frontend/src/context/AuthContext.jsx` – auth state and token persistence

## Verification

The project was validated with fresh runs:

- `pytest -q backend/tests/test_auth.py` → 7 backend auth tests passed
- `npm test -- --run --reporter=basic` → 2 frontend auth UI tests passed
- `npm run build` → production build succeeded and produced the final Vite bundle

## Notes

This project follows a production-conscious authentication pattern with secure defaults and clear separation between API, service, model, and client-side auth layers.
