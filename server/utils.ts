import { db } from './db.js';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-le-jeu-du-train-12345';

export function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Non autorisé' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; isAdmin?: boolean; createdAt?: number };
    const user = db.prepare('SELECT id, created_at FROM users WHERE id = ?').get(decoded.id) as { id: number; created_at: number } | undefined;
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    if (decoded.createdAt === undefined || decoded.createdAt !== user.created_at) {
      return res.status(401).json({ error: 'Session invalide' });
    }
    req.user = { id: user.id, isAdmin: decoded.isAdmin };
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
  // Only runs on authenticated routes, req.user.id is always present
  keyGenerator: (req: any) => req.user.id.toString(),
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
  validate: { xForwardedForHeader: false, trustProxy: false }
});

export const safeJsonParse = (str: string | null) => {
  if (!str) return undefined;
  try { return JSON.parse(str); } catch { return undefined; }
};
