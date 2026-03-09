import { db } from './db';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-le-jeu-du-train-12345';

export function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Non autorisé' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
}

export function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
  validate: { xForwardedForHeader: false }
});

export const gameSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => {
    if (req.user && req.user.id) {
      return req.user.id.toString();
    }
    return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  },
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
  validate: { xForwardedForHeader: false }
});

export const safeJsonParse = (str: string | null) => {
  if (!str) return undefined;
  try { return JSON.parse(str); } catch { return undefined; }
};
