import mongoose, { Schema, Document } from 'mongoose';

interface IUser extends Document {
  email: string;
  password: string;
  username: string;
  aiUsageDate: string;
  aiUsageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    username: { type: String, required: true, trim: true },

    // Daily AI quota: a 'YYYY-MM-DD' UTC stamp and a counter, no events table.
    aiUsageDate: { type: String, default: '' },
    aiUsageCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
