import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// 1. Extend the Express Request object to include our custom userId
export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    // Look for the "Authorization" header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required. Missing Bearer token.' });
      return;
    }

    // Extract the token (e.g., "Bearer eyJhbGci...")
    const token = authHeader.split(' ')[1]!;

    // Verify the token using our secret
    const decoded = jwt.verify(token, env.JWT_SECRET as string);
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('id' in decoded) ||
      !('isDemo' in decoded)
    ) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    // Attach the user ID to the request object so the Controller can use it later
    req.userId = decoded.id as string;

    // Pass the request down the conveyor belt to the next function (the Controller)
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
};
