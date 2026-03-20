import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IShareLink extends Document {
  userId: Types.ObjectId;
  hash: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShareLinkSchema = new Schema<IShareLink>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    hash: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
  }
);

export const ShareLink = mongoose.model<IShareLink>('ShareLink', ShareLinkSchema);
