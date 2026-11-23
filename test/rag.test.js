const mockEmbedText = jest.fn(async () => [0.1, 0.2]);
const mockSearchChunks = jest.fn();
const mockGenerateText = jest.fn(async () => 'Document answer and supplementary explanation.');

jest.mock('../backend/services/embeddingService', () => ({ embedText: (...args) => mockEmbedText(...args) }));
jest.mock('../backend/services/vectorService', () => ({ searchChunks: (...args) => mockSearchChunks(...args) }));
jest.mock('../backend/config/gemini', () => ({ generateText: (...args) => mockGenerateText(...args) }));

const { answerQuestion } = require('../backend/services/ragService');

describe('Educational RAG response', () => {
  beforeEach(() => {
    mockSearchChunks.mockReset();
    mockGenerateText.mockClear();
  });

  test('answers a direct greeting without searching Qdrant Cloud', async () => {
    const result = await answerQuestion('Hi');
    expect(result.answer).toContain('supplementary');
    expect(result.sources).toEqual([]);
  });

  test('requests structured Markdown and separated sections', () => {
    const { SYSTEM_INSTRUCTION } = require('../backend/services/ragService');
    expect(SYSTEM_INSTRUCTION).toContain('clean Markdown');
    expect(SYSTEM_INSTRUCTION).toContain('Document-Supported Information');
    expect(SYSTEM_INSTRUCTION).toContain('Markdown tables');
  });

  test('uses document content and returns source structure', async () => {
    mockSearchChunks.mockResolvedValue([{ id: 'c1', text: 'Fog nodes extend cloud services closer to users.', metadata: { documentId: 'd1', filename: 'fog.pdf', pageNumber: 4 }, score: 0.82 }]);
    const result = await answerQuestion('What is a fog node?', ['d1']);
    expect(result.answer).toContain('Document answer');
    expect(result.sources[0]).toMatchObject({ documentId: 'd1', filename: 'fog.pdf', pageNumber: 4 });
  });

  test('allows general knowledge when PDF contains only A1 question text', async () => {
    mockSearchChunks.mockResolvedValue([{ id: 'c1', text: 'A1. When a node is said to be a fog node?', metadata: { documentId: 'd1', filename: 'fog.pdf', pageNumber: 2 }, score: 0.88 }]);
    const result = await answerQuestion('Give me the answer for A1 in the fog computing PDF', ['d1']);
    const prompt = mockGenerateText.mock.calls[0][0];
    expect(prompt).toContain('A1');
    expect(prompt).toContain('A1. When a node');
    expect(prompt).toContain('Supplementary explanation');
    expect(result.sources.length).toBeGreaterThan(0);
  });

  test('handles partial context by requesting supplementary explanation', async () => {
    mockSearchChunks.mockResolvedValue([{ id: 'c2', text: 'Fog computing reduces latency near edge devices.', metadata: { documentId: 'd1', filename: 'fog.pdf', pageNumber: 5 }, score: 0.50 }]);
    await answerQuestion('Explain the benefits of fog computing', ['d1']);
    const prompt = mockGenerateText.mock.calls[0][0];
    expect(prompt).toContain('supplement');
  });

  test('does not invent PDF sources for unrelated empty retrieval', async () => {
    mockSearchChunks.mockResolvedValue([]);
    const result = await answerQuestion('Explain quantum chemistry', ['d1']);
    expect(mockGenerateText).toHaveBeenCalled();
    expect(mockGenerateText.mock.calls[0][0]).toContain('NO RELEVANT DOCUMENT CONTEXT');
    expect(result.sources).toEqual([]);
  });

  test('retries a refusal-like answer so Gemini supplements question-only PDF context', async () => {
    mockSearchChunks.mockResolvedValue([{ id: 'c1', text: 'A1. When a node is said to be a fog node?', metadata: { documentId: 'd1', filename: 'fog.pdf', pageNumber: 1 }, score: 0.88 }]);
    mockGenerateText
      .mockResolvedValueOnce('The document only contains the question and does not provide the answer.')
      .mockResolvedValueOnce('Direct answer: A fog node is a node that provides fog-computing services near edge devices.\n\nSupplementary explanation (general knowledge): ...');

    const result = await answerQuestion('Explain A1', ['d1']);

    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(mockGenerateText.mock.calls[1][0]).toContain('complete educational answer');
    expect(result.answer).toContain('Supplementary explanation');
  });
});
