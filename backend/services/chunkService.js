// Chunking makes PDFs searchable in small, focused pieces. Overlap preserves context
// that may begin near a boundary so a sentence is not cut off and lost.
function splitText(text, chunkSize = Number(process.env.CHUNK_SIZE || 1000), overlap = Number(process.env.CHUNK_OVERLAP || 200)) {
  chunkSize = Math.max(100, Number(chunkSize));
  overlap = Math.min(Math.max(0, Number(overlap)), chunkSize - 1);
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}

function chunkDocument(documentId, filename, text, pageCount = null) {
  // pdf-parse commonly separates pages with form-feed characters.
  const pages = String(text || '').split(/\f+/);
  const chunks = [];
  let chunkIndex = 0;
  pages.forEach((pageText, pageOffset) => {
    if (!pageText.trim()) return;
    const pageNumber = pageCount ? pageOffset + 1 : null;
    for (const content of splitText(pageText)) {
      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        filename,
        pageNumber,
        chunkIndex,
        text: content
      });
      chunkIndex += 1;
    }
  });
  if (!chunks.length) {
    const error = new Error('The PDF contains no extractable text. Scanned PDFs require OCR, which is not supported in this version.');
    error.statusCode = 400;
    throw error;
  }
  return chunks;
}

module.exports = { splitText, chunkDocument };
