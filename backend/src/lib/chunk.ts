/**
 * Splits text into overlapping chunks on paragraph boundaries. The overlap
 * carries the tail of one chunk into the head of the next, so a thought split
 * across a boundary is still embedded intact somewhere.
 */
export const chunkText = (text: string, size: number, overlap: number): string[] => {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  const push = (chunk: string): void => {
    const trimmed = chunk.trim();
    if (trimmed) chunks.push(trimmed);
  };

  let current = '';

  for (const paragraph of paragraphs) {
    // A paragraph longer than the chunk size can never fit, so hard-split it.
    if (paragraph.length > size) {
      push(current);
      current = '';

      const step = Math.max(size - overlap, 1);
      for (let start = 0; start < paragraph.length; start += step) {
        push(paragraph.slice(start, start + size));
      }
      continue;
    }

    if (current && current.length + paragraph.length + 2 > size) {
      push(current);
      current = current.slice(-overlap);
    }

    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }

  push(current);

  return chunks;
};
