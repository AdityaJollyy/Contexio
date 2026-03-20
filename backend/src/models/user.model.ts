import mongoose, { Schema, Document } from 'mongoose';

// 1. Create a TypeScript Interface representing a document in MongoDB.
export interface IUser extends Document {
  email: string;
  password: string; // Will be hashed
  username: string;
  isDemo: boolean;
  expireAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Create the Mongoose Schema corresponding to the Interface.
const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    username: { type: String, required: true, trim: true },
    isDemo: { type: Boolean, default: false },
    expireAt: { type: Date, default: null, expires: 0 }, // TTL index
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// 3. Export the Model.
export const User = mongoose.model<IUser>('User', UserSchema);
