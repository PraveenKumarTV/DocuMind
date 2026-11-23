jest.mock('../backend/services/embeddingService', () => ({ embedText: jest.fn(async () => [0.1, 0.2]) }));
jest.mock('../backend/services/vectorService', () => ({ searchChunks: jest.fn(async () => [{ id: 'c1', text: 'Revenue was 10 million.', metadata: { documentId: 'd1', filename: 'report.pdf', pageNumber: 3 } }]) }));
jest.mock('../backend/config/gemini', () => ({ generateText: jest.fn(async () => 'Revenue was 10 million.') }));
const { answerQuestion } = require('../backend/services/ragService');

describe('RAG response', () => {
  test('answers a direct greeting without searching Qdrant Cloud', async () => {
    const result = await answerQuestion('Hi');
    expect(result.answer).toBe('Revenue was 10 million.');
    expect(result.sources).toEqual([]);
  });

  test('returns answer and source structure', async () => {
    const result = await answerQuestion('What was revenue?', ['d1']);
    expect(result.answer).toBe('Revenue was 10 million.');
    expect(result.sources[0]).toMatchObject({ documentId: 'd1', filename: 'report.pdf', pageNumber: 3 });
  });
});
