import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { getErrorMessage } from '../lib/errors.js';

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/**
 * Generates a short, human-readable summary of the provided text.
 */
export const generateSummary = async (text: string): Promise<string> => {
  if (!text || text.trim() === '') return '';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `You are an AI assistant. Summarize the following content in 1-3 concise sentences.\n\n<content>${text}</content>`,
    });

    return response.text?.trim() || '';
  } catch (error) {
    console.error('AI Summarization failed:', getErrorMessage(error));
    return '';
  }
};

/**
 * Generates a high-dimensional vector embedding for the given text.
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!text || text.trim() === '') return [];

  try {
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text,
      config: { outputDimensionality: 768 },
    });

    return result.embeddings?.[0]?.values || [];
  } catch (error) {
    console.error('AI Embedding failed:', getErrorMessage(error));
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
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });

    return response.text?.trim() || 'Sorry, I could not generate an answer.';
  } catch (error) {
    console.error('AI Chat failed:', getErrorMessage(error));
    return 'An error occurred while trying to consult your Second Brain.';
  }
};
