import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

const SECRET_KEY = process.env.SECRET_KEY || 'prodygy-secret-key-change-in-production-12345';
const ACCESS_TOKEN_EXPIRE_MINUTES = Number(process.env.ACCESS_TOKEN_EXPIRE_MINUTES) || 30;
const REFRESH_TOKEN_EXPIRE_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 7;

app.use(express.json());

interface User {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RefreshTokenRecord {
  token: string;
  user_id: number;
  expires_at: number;
  revoked: boolean;
}

// In-memory data layer
const users = new Map<number, User>();
const usersByEmail = new Map<string, number>();
const refreshTokens = new Map<string, RefreshTokenRecord>();
const revokedTokens = new Set<string>();
const loginAttempts = new Map<string, number[]>();

let nextUserId = 1;

function checkRateLimit(identifier: string) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const timestamps = (loginAttempts.get(identifier) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= 5) {
    throw new Error('RATE_LIMIT_EXCEEDED');
  }
  timestamps.push(now);
  loginAttempts.set(identifier, timestamps);
}

function generateTokens(user: User): { accessToken: string; refreshToken: string } {
  const expSeconds = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRE_MINUTES * 60;
  const accessToken = jwt.sign(
    { sub: String(user.id), exp: expSeconds, type: 'access' },
    SECRET_KEY,
    { algorithm: 'HS256' }
  );

  const refreshTokenValue = crypto.randomBytes(32).toString('hex');
  const refreshExpMs = Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

  // Revoke previous active tokens for this user
  for (const record of refreshTokens.values()) {
    if (record.user_id === user.id && !record.revoked) {
      record.revoked = true;
    }
  }

  refreshTokens.set(refreshTokenValue, {
    token: refreshTokenValue,
    user_id: user.id,
    expires_at: refreshExpMs,
    revoked: false,
  });

  return { accessToken, refreshToken: refreshTokenValue };
}

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ detail: 'Authentication required.' });
  }

  const token = authHeader.slice(7).trim();
  if (!token || revokedTokens.has(token)) {
    return res.status(401).json({ detail: 'Invalid or expired token.' });
  }

  try {
    const payload = jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] }) as any;
    if (payload.type !== 'access') {
      return res.status(401).json({ detail: 'Invalid token type.' });
    }
    const userId = Number(payload.sub);
    const user = users.get(userId);
    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'Invalid or expired token.' });
    }
    (req as any).user = user;
    (req as any).token = token;
    next();
  } catch {
    return res.status(401).json({ detail: 'Invalid or expired token.' });
  }
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth Routes
app.post('/api/auth/register', (req, res) => {
  const { full_name, email, password, password_confirm } = req.body || {};
  const errors: Array<{ loc: string[]; msg: string; type: string; ctx?: any }> = [];

  const trimmedName = typeof full_name === 'string' ? full_name.trim().replace(/\s+/g, ' ') : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!full_name || trimmedName.length < 2) {
    errors.push({
      loc: ['body', 'full_name'],
      msg: 'Full name must contain at least 2 characters.',
      type: 'string_too_short',
      ctx: { min_length: 2 },
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(normalizedEmail)) {
    errors.push({
      loc: ['body', 'email'],
      msg: 'Enter a valid email address.',
      type: 'value_error',
    });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push({
      loc: ['body', 'password'],
      msg: 'Password must be at least 8 characters long.',
      type: 'string_too_short',
      ctx: { min_length: 8 },
    });
  } else {
    if (!/[A-Z]/.test(password)) {
      errors.push({
        loc: ['body', 'password'],
        msg: 'Password must contain at least one uppercase letter.',
        type: 'value_error',
      });
    }
    if (!/[0-9]/.test(password)) {
      errors.push({
        loc: ['body', 'password'],
        msg: 'Password must contain at least one number.',
        type: 'value_error',
      });
    }
  }

  if (password && password_confirm !== password) {
    errors.push({
      loc: ['body', 'password_confirm'],
      msg: 'Value error, Passwords do not match.',
      type: 'value_error',
    });
  }

  if (errors.length > 0) {
    return res.status(422).json({ detail: errors });
  }

  if (usersByEmail.has(normalizedEmail)) {
    return res.status(400).json({ detail: 'Email already registered.' });
  }

  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(password, 10);
  const user: User = {
    id: nextUserId++,
    full_name: trimmedName,
    email: normalizedEmail,
    password_hash: passwordHash,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  users.set(user.id, user);
  usersByEmail.set(user.email, user.id);

  const { accessToken, refreshToken } = generateTokens(user);

  return res.status(201).json({
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    tokens: {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
    },
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  try {
    checkRateLimit(`${normalizedEmail}:${clientIp}`);
  } catch {
    return res.status(429).json({ detail: 'Too many login attempts. Please try again later.' });
  }

  const userId = usersByEmail.get(normalizedEmail);
  const user = userId ? users.get(userId) : null;

  if (!user || !password || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ detail: 'Invalid email or password.' });
  }

  const { accessToken, refreshToken } = generateTokens(user);

  return res.json({
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    tokens: {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
    },
  });
});

app.post('/api/auth/refresh', (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) {
    return res.status(401).json({ detail: 'Missing refresh token.' });
  }

  const record = refreshTokens.get(refresh_token);
  if (!record || record.revoked) {
    return res.status(401).json({ detail: 'Invalid refresh token.' });
  }

  if (record.expires_at <= Date.now()) {
    record.revoked = true;
    return res.status(401).json({ detail: 'Refresh token expired.' });
  }

  record.revoked = true;
  const user = users.get(record.user_id);
  if (!user || !user.is_active) {
    return res.status(401).json({ detail: 'Invalid refresh token.' });
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
  return res.json({
    access_token: accessToken,
    refresh_token: newRefreshToken,
    token_type: 'bearer',
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) revokedTokens.add(token);
  }

  const { refresh_token } = req.body || {};
  if (refresh_token && refreshTokens.has(refresh_token)) {
    const record = refreshTokens.get(refresh_token)!;
    record.revoked = true;
  }

  return res.json({ message: 'Logged out successfully.' });
});

// Users Routes
app.get('/api/users/me', authenticateToken, (req, res) => {
  const user = (req as any).user as User;
  return res.json({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
  });
});

app.patch('/api/users/me', authenticateToken, (req, res) => {
  const user = (req as any).user as User;
  const { full_name } = req.body || {};

  if (full_name !== undefined && typeof full_name === 'string') {
    user.full_name = full_name.trim().replace(/\s+/g, ' ');
    user.updated_at = new Date().toISOString();
  }

  return res.json({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Prodygy Auth Server listening on http://${HOST}:${PORT}`);
  });
}

startServer();
