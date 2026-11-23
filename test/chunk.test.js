process.env.CHUNK_SIZE='100'; process.env.CHUNK_OVERLAP='20';
const { splitText, chunkDocument } = require('../backend/services/chunkService');

describe('text chunking', () => {
  test('creates overlapping chunks and avoids empties', () => {
    const chunks = splitText('A'.repeat(220), 100, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length > 0)).toBe(true);
  });
  test('rejects documents with no extractable text', () => {
    expect(() => chunkDocument('doc-1', 'scan.pdf', '   ', 2)).toThrow(/no extractable text/);
  });
});
