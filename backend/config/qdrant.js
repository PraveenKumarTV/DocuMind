const { QdrantClient } = require('@qdrant/js-client-rest');

let client;

function validateQdrantConfig() {
  const missing = ['QDRANT_URL', 'QDRANT_API_KEY']
    .filter(name => !process.env[name]);
  if (missing.length) {
    const error = new Error(`Qdrant Cloud is not configured. Missing: ${missing.join(', ')}`);
    error.statusCode = 503;
    error.code = 'QDRANT_CONFIG_MISSING';
    throw error;
  }

  const url = process.env.QDRANT_URL.trim();
  if (!/^https:\/\//i.test(url)) {
    const error = new Error('QDRANT_URL must be an HTTPS Qdrant Cloud endpoint');
    error.statusCode = 503;
    error.code = 'QDRANT_INVALID_URL';
    throw error;
  }
}

function getQdrantClient() {
  validateQdrantConfig();
  if (!client) {
    client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      timeout: 20000,
      checkCompatibility: false
    });
  }
  return client;
}

async function checkQdrantConnection() {
  const qdrant = getQdrantClient();
  try {
    await qdrant.getCollections();
    return true;
  } catch (error) {
    const wrapped = new Error('Qdrant Cloud is unreachable or authentication failed');
    wrapped.statusCode = 502;
    wrapped.code = 'QDRANT_CONNECTION_ERROR';
    wrapped.cause = error;
    throw wrapped;
  }
}

module.exports = { getQdrantClient, checkQdrantConnection, validateQdrantConfig };
