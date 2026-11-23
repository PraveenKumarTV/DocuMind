const { generateEmbedding } = require('../config/gemini');

async function embedTexts(texts) {
  const vectors = [];
  // Gemini embedding calls are serialized here to respect free-tier concurrency limits.
  for (const text of texts) vectors.push(await generateEmbedding(text));
  const dimension = vectors[0]?.length;
  if (dimension && vectors.some(vector => vector.length !== dimension)) {
    throw new Error('Embedding vectors have incompatible dimensions');
  }
  return vectors;
}

async function embedText(text) {
  return generateEmbedding(text);
}

module.exports = { embedTexts, embedText };
