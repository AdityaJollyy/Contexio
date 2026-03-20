import { type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/user.model.js';
import { env } from '../config/env.js';

// 1. Zod Schemas for Input Validation
const signupSchema = z.object({
  email: z.email(),
  username: z.string().min(3).max(50),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/\d/, 'Password must include at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must include at least one special character'),
});

const signinSchema = z.object({
  email: z.email(),
  password: z.string().min(1), // Just need to ensure they provided *something* to check
});

// 2. Controller Functions
export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input using Zod
    const parsedBody = signupSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'Invalid inputs', errors: parsedBody.error.format() });
      return;
    }

    const { email, username, password } = parsedBody.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ message: 'User already exists with this email' });
      return;
    }

    // Hash password & trim username
    const hashedPassword = await bcrypt.hash(password, 10);
    const trimmedUsername = username.split(' ')[0]?.slice(0, 20) || '';

    // Create user
    await User.create({
      email,
      username: trimmedUsername,
      password: hashedPassword,
      isDemo: false,
      expireAt: null,
    });

    res.status(201).json({ message: 'Successfully signed up. Please log in.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error during signup' });
  }
};

export const signin = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedBody = signinSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'Invalid inputs', errors: parsedBody.error });
      return;
    }

    const { email, password } = parsedBody.data;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    // Generate JWT Token
    const token = jwt.sign({ id: user._id, isDemo: user.isDemo }, env.JWT_SECRET, {
      expiresIn: '7d', // Token lasts for 7 days
    });

    res.status(200).json({
      message: 'Signed in successfully',
      token,
      user: { username: user.username, isDemo: user.isDemo },
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ message: 'Internal server error during signin' });
  }
};

export const demoLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const uniqueId = `demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const demoUser = await User.create({
      email: `${uniqueId}@demo.com`,
      username: 'Guest',
      password: await bcrypt.hash('DemoPassword123!', 10), // Required by schema
      isDemo: true,
      expireAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // MongoDB will auto-delete in 2 hours
    });

    const token = jwt.sign({ id: demoUser._id, isDemo: true }, env.JWT_SECRET, {
      expiresIn: '2h',
    });

    res.status(200).json({
      message: 'Demo session started',
      token,
      user: { username: demoUser.username, isDemo: true },
    });
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({ message: 'Failed to start demo session' });
  }
};
