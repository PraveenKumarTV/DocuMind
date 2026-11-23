const { createHash } = require('crypto');
const { getQdrantClient } = require('../config/qdrant');

function collectionName() {
  return process.env.QDRANT_COLLECTION || 'documind_documents';
}

function qdrantError(operation, error) {
  if (error?.statusCode) return error;
  const wrapped = new Error(`Qdrant Cloud ${operation} failed`);
  wrapped.statusCode = 502;
  wrapped.code = `QDRANT_${operation.toUpperCase().replace(/ /g, '_')}_FAILED`;
  wrapped.cause = error;
  return wrapped;
}

async function initializeCollection(expectedDimension) {
  if (!Number.isInteger(expectedDimension) || expectedDimension < 1) {
    throw new Error('A valid positive embedding dimension is required for Qdrant collection initialization');
  }
  const client = getQdrantClient();
  const name = collectionName();
  try {
    const existence = await client.collectionExists(name);
    const exists = typeof existence === 'boolean' ? existence : Boolean(existence?.exists);
    if (!exists) {
      await client.createCollection(name, {
        vectors: { size: expectedDimension, distance: 'Cosine' }
      });
      await client.createPayloadIndex(name, {
        field_name: 'documentId',
        field_schema: 'keyword',
        wait: true
      });
      return { exists: false, dimension: expectedDimension, name };
    }

    const info = await client.getCollection(name);
    const configured = info?.config?.params?.vectors;
    const existingDimension = configured && typeof configured === 'object' && !Array.isArray(configured)
      ? configured.size
      : undefined;

    const payloadSchema = info?.payload_schema || {};
    if (!payloadSchema.documentId) {
      await client.createPayloadIndex(name, {
        field_name: 'documentId',
        field_schema: 'keyword',
        wait: true
      });
    }

    if (existingDimension && existingDimension !== expectedDimension) {
      const error = new Error(`Qdrant collection dimension mismatch: collection has ${existingDimension}, but Gemini embeddings have ${expectedDimension}. No collection was deleted or recreated.`);
      error.statusCode = 409;
      error.code = 'QDRANT_DIMENSION_MISMATCH';
      throw error;
    }
    return { exists: true, dimension: existingDimension || expectedDimension, name };
  } catch (error) {
    if (error?.statusCode) throw error;
    throw qdrantError('collection initialization', error);
  }
}

function stableUuid(documentId, chunkIndex) {
  const hex = createHash('sha256').update(`${documentId}:${chunkIndex}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function insertChunks(chunks, embeddings) {
  if (chunks.length !== embeddings.length) throw new Error('Chunk and embedding counts do not match');
  if (!chunks.length) return;

  const dimensions = new Set(embeddings.map(vector => vector.length));
  if (dimensions.size !== 1) throw new Error('Embedding dimension mismatch in document chunks');
  const dimension = dimensions.values().next().value;
  await initializeCollection(dimension);

  const points = chunks.map((chunk, index) => ({
    id: stableUuid(chunk.documentId, chunk.chunkIndex),
    vector: embeddings[index],
    payload: {
      documentId: chunk.documentId,
      filename: chunk.filename,
      text: chunk.text,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber == null ? -1 : chunk.pageNumber,
      uploadTimestamp: chunk.uploadedAt || new Date().toISOString()
    }
  }));

  try {
    await getQdrantClient().upsert(collectionName(), { wait: true, points });
  } catch (error) { throw qdrantError('vector insertion', error); }
}

async function searchSimilarChunks(queryEmbedding, topK = Number(process.env.TOP_K || 5), documentIds = null) {
  if (!Array.isArray(queryEmbedding) || !queryEmbedding.length) {
    throw new Error('A non-empty question embedding is required');
  }
  await initializeCollection(queryEmbedding.length);

  let filter;
  if (documentIds?.length) {
    filter = documentIds.length === 1
      ? { must: [{ key: 'documentId', match: { value: documentIds[0] } }] }
      : { must: [{ key: 'documentId', match: { any: documentIds } }] };
  }

  try {
    const results = await getQdrantClient().search(collectionName(), {
      vector: queryEmbedding,
      limit: Number(topK),
      with_payload: true,
      ...(filter ? { filter } : {})
    });
    return results.map(result => ({
      id: String(result.id),
      text: result.payload?.text || '',
      metadata: {
        documentId: result.payload?.documentId,
        filename: result.payload?.filename,
        chunkIndex: result.payload?.chunkIndex,
        pageNumber: result.payload?.pageNumber > 0 ? result.payload.pageNumber : null,
        uploadTimestamp: result.payload?.uploadTimestamp
      },
      score: result.score
    }));
  } catch (error) { throw qdrantError('similarity search', error); }
}

async function deleteDocumentVectors(documentId) {
  if (!documentId) throw new Error('documentId is required');
  try {
    await getQdrantClient().delete(collectionName(), {
      wait: true,
      filter: { must: [{ key: 'documentId', match: { value: documentId } }] }
    });
  } catch (error) { throw qdrantError('document deletion', error); }
}

async function checkQdrantConnection() {
  const client = getQdrantClient();
  try {
    await client.getCollections();
    const existence = await client.collectionExists(collectionName());
    const exists = typeof existence === 'boolean' ? existence : Boolean(existence?.exists);
    if (!exists) return { connected: true, collectionExists: false, name: collectionName() };
    const info = await client.getCollection(collectionName());
    const vectors = info?.config?.params?.vectors;
    return {
      connected: true,
      collectionExists: true,
      name: collectionName(),
      dimension: typeof vectors === 'object' && vectors ? vectors.size : undefined,
      distance: typeof vectors === 'object' && vectors ? vectors.distance : undefined
    };
  } catch (error) { throw qdrantError('connection check', error); }
}

module.exports = {
  initializeCollection,
  insertChunks,
  searchSimilarChunks,
  deleteDocumentVectors,
  checkQdrantConnection,
  // Existing controller/RAG imports remain valid after the database migration.
  addChunks: insertChunks,
  searchChunks: searchSimilarChunks
};
