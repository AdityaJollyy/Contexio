import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthRequest extends Request {
  userId?: string;
}

interface JwtPayload {
  id: string;
}

function isValidJwtPayload(decoded: unknown): decoded is JwtPayload {
  return (
    typeof decoded === 'object' &&
    decoded !== null &&
    'id' in decoded &&
    typeof (decoded as JwtPayload).id === 'string'
  );
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required. Missing Bearer token.' });
      return;
    }

    const parts = authHeader.split(' ');
    const token = parts[1];

    if (!token) {
      res.status(401).json({ message: 'Authentication required. Malformed Bearer token.' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (!isValidJwtPayload(decoded)) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    req.userId = decoded.id;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
};
