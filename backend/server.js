require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const documentRoutes = require('./routes/documentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { checkQdrantConnection } = require('./config/qdrant');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  limit: Number(process.env.RATE_LIMIT_MAX || 100),
  standardHeaders: 'draft-7', legacyHeaders: false
}));

app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/health', async (req, res) => {
  let qdrantStatus = { status: 'unavailable' };
  try {
    await checkQdrantConnection();
    qdrantStatus = { status: 'ok', provider: 'qdrant-cloud' };
  } catch (error) {
    qdrantStatus = {
      status: 'unavailable',
      provider: 'qdrant-cloud',
      error: error.code === 'QDRANT_CONFIG_MISSING'
        ? 'Qdrant Cloud credentials are not configured'
        : 'Qdrant Cloud is unreachable or authentication failed'
    };
  }
  res.status(qdrantStatus.status === 'ok' ? 200 : 503).json({
    success: qdrantStatus.status === 'ok',
    backend: 'ok',
    gemini: { configured: Boolean(process.env.GEMINI_API_KEY) },
    qdrant: qdrantStatus
  });
});

app.use('/vendor/marked', express.static(path.join(__dirname, '..', 'node_modules', 'marked', 'lib')));
app.use('/vendor/dompurify', express.static(path.join(__dirname, '..', 'node_modules', 'dompurify', 'dist')));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));
app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const port = Number(process.env.PORT || 5000);
  app.listen(port, () => console.log(`DocuMind backend listening on http://localhost:${port}`));
}

module.exports = app;
