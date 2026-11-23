const { GoogleGenAI } = require('@google/genai');

// One reusable client keeps the API key server-side and uses the SDK for embeddings and generation.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

function transientError(error) {
  const status = error?.status || error?.statusCode || error?.response?.status;
  return status === 429 || status === 408 || (typeof status === 'number' && status >= 500);
}

async function withRetry(operation, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (!transientError(error) || attempt === attempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (2 ** attempt)));
    }
  }
  throw lastError;
}

async function generateEmbedding(text) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
  return withRetry(async () => {
    const response = await ai.models.embedContent({ model, contents: [{ text }] });
    const vector = response.embeddings?.[0]?.values;
    if (!Array.isArray(vector) || !vector.length) throw new Error('Gemini returned an empty embedding');
    return vector;
  });
}

async function generateText(prompt, systemInstruction) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const model = process.env.GEMINI_GENERATION_MODEL || 'gemini-flash-lite-latest';

  try {
    return await withRetry(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: systemInstruction ? { systemInstruction } : undefined
      });
      const text = response.text || response.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
      if (!text.trim()) throw new Error('Gemini returned an empty response');
      return text.trim();
    });
  } catch (sdkError) {
    // Fallback for SDK transport failures: use the official Gemini REST endpoint with the same key.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        }),
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data?.error?.message || 'Gemini generation request failed');
        error.statusCode = response.status === 429 ? 429 : 502;
        throw error;
      }
      const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text).filter(Boolean).join('') || '';
      if (!text.trim()) throw new Error('Gemini returned an empty response');
      return text.trim();
    } finally { clearTimeout(timeout); }
  }
}

module.exports = { generateEmbedding, generateText, withRetry };
