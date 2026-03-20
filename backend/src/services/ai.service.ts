import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// Generates a short, human-readable summary of the provided text.
export const generateSummary = async (text: string): Promise<string> => {
  // Guard: skip API call entirely if there's nothing to summarize
  if (!text || text.trim() === '') return '';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `You are an AI assistant. Summarize the following content in 1-3 concise sentences.\n\n<content>${text}</content>`,
    });

    // `response.text` is the unified text accessor in the new SDK
    return response.text?.trim() || '';
  } catch (error) {
    // Non-fatal: if summarization fails, the worker still continues
    // and embeds the raw metadata without an AI summary
    console.error('⚠️ AI Summarization failed:', (error as Error).message);
    return '';
  }
};

// Generates a high-dimensional vector embedding for the given text.
export const generateEmbedding = async (text: string): Promise<number[]> => {
  // Guard: return empty array early, no API call needed
  if (!text || text.trim() === '') return [];

  try {
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text,
    });

    // `result.embeddings` is an array; we always embed a single string so index [0] is safe
    return result.embeddings?.[0]?.values || [];
  } catch (error) {
    console.error('⚠️ AI Embedding failed:', (error as Error).message);

    // Unlike summarization, embeddings are MANDATORY for the AI search feature to work.
    // We intentionally throw here so the worker marks the job as 'retrying' / 'failed'
    // rather than silently saving an item with no embedding.
    throw new Error('Failed to generate embedding');
  }
};

/**
 * RAG Implementation: Answering questions based on specific context
 */
export const answerFromContext = async (question: string, context: string): Promise<string> => {
  try {
    const prompt = `
      You are an intelligent assistant for a "Second Brain" application. 
      Answer the user's question using ONLY the provided context from their saved notes.
      If the answer is not contained within the context, politely say "I don't have enough information in your saved content to answer that."
      
      Context from User's Brain:
      ${context}

      User's Question:
      ${question}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
    });

    return response.text?.trim() || 'Sorry, I could not generate an answer.';
  } catch (error) {
    console.error('⚠️ AI Chat failed:', (error as Error).message);
    return 'An error occurred while trying to consult your Second Brain.';
  }
};
