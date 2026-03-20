import mongoose, { Schema, Document, Types } from 'mongoose';

export type ContentType = 'youtube' | 'twitter' | 'github' | 'text' | 'others';
export type ProcessingStatus = 'pending' | 'retrying' | 'ready' | 'failed';

export interface IContent extends Document {
  title: string;
  description: string;
  link: string;
  type: ContentType;
  userId: Types.ObjectId;
  metadata: string;
  aiSummary: string;
  embedding?: number[];
  status: ProcessingStatus;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ContentSchema = new Schema<IContent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    link: { type: String, default: '' },
    type: {
      type: String,
      enum: ['youtube', 'twitter', 'github', 'text', 'others'],
      default: 'others',
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // Internal/AI Fields
    metadata: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    embedding: { type: [Number], default: undefined },

    // Background Worker Status Fields
    status: {
      type: String,
      enum: ['pending', 'retrying', 'ready', 'failed'],
      default: 'pending',
      index: true, // Makes queue polling lightning fast!
    },
    retryCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const Content = mongoose.model<IContent>('Content', ContentSchema);
