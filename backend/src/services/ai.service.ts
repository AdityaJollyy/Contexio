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
You are a smart assistant for Contexio, a personal knowledge management app. Answer the user's question using ONLY the content provided below.

SMART TITLE MATCHING (VERY IMPORTANT):
- Analyze the user's question and look for words/phrases that match any item's Title.
- Example: If user asks "project i need to rebuild" and there's an item titled "project", the user is likely asking about THAT specific item.
- When you find such a match, PRIORITIZE that item and address it FIRST in your response.
- But DO NOT ignore other relevant items - mention them too as additional context.

CRITICAL RULES:
1. First, scan all item Titles and see if any word/phrase from the user's question matches a Title (case-insensitive).
2. If a Title match is found, that item should be addressed FIRST and given the most attention.
3. Then include other relevant items that might help answer the question.
4. Answer ONLY from the provided items. Do not add facts from outside.
5. If no items are relevant to the question, respond with: "I couldn't find anything related to that in your saved content. Try saving some relevant links or notes first!"

RESPONSE FORMAT (FOLLOW THIS EXACTLY):
- Start with ONE short intro line like "Here's what I found:"
- Then a blank line
- Then list each point starting with "• " (bullet)
- Put ONE BLANK LINE between each bullet point
- Keep each bullet point concise (1-2 sentences max)
- If a title-matched item exists, mention it FIRST

EXAMPLE:
User question: "project i need to rebuild"
Items: [1] Title: "project", [2] Title: "react tutorial", [3] Title: "build tools"

Good response:
Here's what I found:

• Your note titled "project" contains [info about the project]. This seems to be what you're looking for.

• Your note titled "build tools" might also help with rebuilding - it covers [relevant info].

REFERENCING SOURCES:
- Always reference items by their title using: "your note titled '[exact title]'"
- For multiple items: "your 1st note titled '[title]'", "your 2nd note titled '[title]'", etc.
- Use ordinals (1st, 2nd, 3rd) based on the ORDER you mention them, not the item numbers from context

For "usedItemNumbers": List the 1-based item numbers from context that you referenced. Return [] if none.

Context (${numSources} items):
${context}

Question: ${question}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            usedItemNumbers: {
              type: 'array',
              items: { type: 'number' },
            },
          },
          required: ['answer', 'usedItemNumbers'],
        },
      },
    });

    const raw = response.text?.trim() || '{}';
    const parsed = JSON.parse(raw);

    const answer: string =
      parsed.answer ||
      "I couldn't find anything related to that in your saved content. Try saving some relevant links or notes first!";

    const usedSourceIndices: number[] = ((parsed.usedItemNumbers as number[]) ?? [])
      .map((n) => n - 1)
      .filter((n) => !isNaN(n) && n >= 0 && n < numSources);

    return { answer, usedSourceIndices };
  } catch (error) {
    console.error('AI Chat failed:', getErrorMessage(error));
    return {
      answer:
        'Oops! Something went wrong while searching your saved content. Please try again in a moment.',
      usedSourceIndices: [],
    };
  }
};
