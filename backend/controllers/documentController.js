const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { extractPdf, removeFile } = require('../services/pdfService');
const { chunkDocument } = require('../services/chunkService');
const { embedTexts } = require('../services/embeddingService');
const { addChunks, deleteDocumentVectors } = require('../services/vectorService');

const documents = new Map();

async function upload(req, res, next) {
  if (!req.file) return res.status(400).json({ success: false, error: 'A PDF file is required' });
  const documentId = randomUUID();
  const filePath = req.file.path;
  const metadata = {
    id: documentId,
    filename: req.file.originalname,
    uploadedAt: new Date().toISOString(),
    pageCount: null,
    chunkCount: 0,
    status: 'processing',
    sizeBytes: req.file.size
  };
  documents.set(documentId, metadata);

  try {
    const extracted = await extractPdf(filePath);
    metadata.pageCount = extracted.pageCount;
    const chunks = chunkDocument(documentId, req.file.originalname, extracted.text, extracted.pageCount);
    chunks.forEach(chunk => { chunk.uploadedAt = metadata.uploadedAt; });
    const embeddings = await embedTexts(chunks.map(chunk => chunk.text));
    await addChunks(chunks, embeddings);
    metadata.chunkCount = chunks.length;
    metadata.status = 'completed';
    await removeFile(filePath);
    res.status(201).json({ success: true, document: metadata });
  } catch (error) {
    metadata.status = 'failed';
    metadata.error = error.statusCode ? error.message : 'Document processing failed';
    await removeFile(filePath);
    next(error);
  }
}

function list(req, res) {
  res.json({ success: true, documents: [...documents.values()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)) });
}

function getOne(req, res) {
  const document = documents.get(req.params.id);
  if (!document) return res.status(404).json({ success: false, error: 'Document not found' });
  res.json({ success: true, document });
}

async function remove(req, res, next) {
  try {
    if (!documents.has(req.params.id)) return res.status(404).json({ success: false, error: 'Document not found' });
    await deleteDocumentVectors(req.params.id);
    documents.delete(req.params.id);
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) { next(error); }
}

module.exports = { upload, list, getOne, remove, documents };
