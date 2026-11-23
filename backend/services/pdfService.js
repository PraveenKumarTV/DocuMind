const fs = require('fs/promises');
const pdfParse = require('pdf-parse');

async function extractPdf(filePath) {
  const buffer = await fs.readFile(filePath);
  let result;
  try { result = await pdfParse(buffer); } catch (error) {
    const e = new Error('The uploaded PDF is corrupted or unreadable'); e.statusCode = 400; throw e;
  }
  const text = (result.text || '').replace(/\r\n/g, '\n').trim();
  if (!text) {
    const e = new Error('This PDF has no extractable text. Scanned/image-only PDFs require OCR, which is not supported in this version.');
    e.statusCode = 400;
    throw e;
  }
  return { text, pageCount: result.numpages || null };
}

async function removeFile(filePath) {
  if (!filePath) return;
  await fs.unlink(filePath).catch(() => {});
}

module.exports = { extractPdf, removeFile };
