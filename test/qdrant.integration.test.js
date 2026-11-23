require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const configured = Boolean(process.env.QDRANT_URL && process.env.QDRANT_API_KEY);

(configured ? describe : describe.skip)('Qdrant Cloud integration', () => {
  test('connects and reads collection state without deleting existing data', async () => {
    const { checkQdrantConnection } = require('../backend/config/qdrant');
    await expect(checkQdrantConnection()).resolves.toBe(true);

    const vectorService = require('../backend/services/vectorService');
    const status = await vectorService.checkQdrantConnection();
    expect(status.connected).toBe(true);
    expect(status.name).toBe(process.env.QDRANT_COLLECTION || 'documind_documents');
  }, 30000);
});
