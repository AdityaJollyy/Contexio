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
      model: 'gemini-3.1-flash-lite-preview',
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
 * Returns both the answer and indices of sources that were actually used
 */
export const answerFromContext = async (
  question: string,
  context: string,
  numSources: number
): Promise<{ answer: string; usedSourceIndices: number[] }> => {
  try {
    const prompt = `
      You are an intelligent assistant for Contexio. 
      Answer the user's question using ONLY the provided context from their saved notes.
      If the answer is not contained within the context, politely say "I don't have enough information in your saved content to answer that."
      
      IMPORTANT FORMATTING RULES:
      - Start with a friendly introduction sentence like "Based on your saved notes, [brief summary of what you found]."
      - Then structure your answer as bullet points using asterisks (*)
      - Be smart about referencing resources:
        * If there is only ONE resource: Say "According to your note" or "The resource explains" (don't say "1st resource")
        * If there are TWO resources: Say "One resource explains..." and "Another resource mentions..."
        * If there are THREE or more: Use "1st resource", "2nd resource", "3rd resource", etc.
      - Provide detailed and comprehensive information from each resource when applicable
      - Leave ONE blank line between each bullet point
      - DO NOT use asterisks (**) or underscores (__) for bold or italic text
      - Keep responses clear and readable without any text highlighting
      - Order your bullet points to match the sequence of items (Item 1 first, then Item 2, etc.)
      
      IMPORTANT: After your answer, on a new line, add "SOURCES_USED: " followed by comma-separated numbers (1 to ${numSources}) of the items you used to answer the question.
      For example: "SOURCES_USED: 1,3" if you used Item 1 and Item 3.
      
      Context from User's Brain:
      ${context}

      User's Question:
      ${question}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
    });

    const fullText = response.text?.trim() || 'Sorry, I could not generate an answer.';

    // Extract the sources used
    const sourcesMatch = fullText.match(/SOURCES_USED:\s*([\d,\s]+)/);
    let usedSourceIndices: number[] = [];

    const sourcesRaw = sourcesMatch?.[1];
    if (sourcesRaw) {
      usedSourceIndices = sourcesRaw
        .split(',')
        .map((s) => parseInt(s.trim(), 10) - 1)
        .filter((n) => !isNaN(n) && n >= 0 && n < numSources);
    }

    // Remove the SOURCES_USED line from the answer
    const answer = fullText.replace(/\n?SOURCES_USED:.*$/s, '').trim();

    return { answer, usedSourceIndices };
  } catch (error) {
    console.error('AI Chat failed:', getErrorMessage(error));
    return {
      answer: 'An error occurred while trying to consult your Contexio.',
      usedSourceIndices: [],
    };
  }
};
