import mongoose, { Schema, Document, Types } from 'mongoose';

type ContentType = 'youtube' | 'twitter' | 'github' | 'text' | 'others';
type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface IContent extends Document {
  title: string;
  description: string;
  link: string;
  type: ContentType;
  userId: Types.ObjectId;
  metadata: string;
  aiSummary: string;
  topics: string[];
  partial: boolean;
  status: ProcessingStatus;
  failureReason: string;
  manualRetries: number;
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

    metadata: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    topics: { type: [String], default: [] },

    // The page could not be read; the item is findable from its title and note.
    partial: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed'],
      default: 'pending',
    },

    // One short sentence the user can read, never the raw error.
    failureReason: { type: String, default: '' },

    // User-initiated retries, separate from BullMQ's own attempt count. One is
    // enough to stop offering the button again.
    manualRetries: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// The list query is find({ userId }).sort({ createdAt: -1 }) — without this
// compound index Mongo sorts in memory and fails once the result set is large.
ContentSchema.index({ userId: 1, createdAt: -1 });

export const Content = mongoose.model<IContent>('Content', ContentSchema);
