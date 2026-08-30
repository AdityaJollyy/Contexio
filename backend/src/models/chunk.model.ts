import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChunk extends Document {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  chunkIndex: number;
  text: string;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const ChunkSchema = new Schema<IChunk>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true, index: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
  },
  {
    timestamps: true,
  }
);

export const Chunk = mongoose.model<IChunk>('Chunk', ChunkSchema);
