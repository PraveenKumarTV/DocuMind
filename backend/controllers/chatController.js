const { randomUUID } = require('crypto');
const { validateQuestion } = require('../utils/validators');
const { answerQuestion } = require('../services/ragService');

const conversations = new Map();

async function chat(req, res, next) {
  try {
    const question = validateQuestion(req.body);
    const conversationId = req.body.conversationId || randomUUID();
    if (!conversations.has(conversationId)) conversations.set(conversationId, []);

    const result = await answerQuestion(question, req.body.documentIds || null);
    const windowSize = Number(process.env.CHAT_HISTORY_WINDOW || 12);
    const messages = conversations.get(conversationId);
    messages.push({ role: 'user', content: question, timestamp: new Date().toISOString() });
    messages.push({ role: 'assistant', content: result.answer, sources: result.sources, timestamp: new Date().toISOString() });
    while (messages.length > windowSize) messages.shift();

    res.json({ success: true, conversationId, answer: result.answer, sources: result.sources });
  } catch (error) { next(error); }
}

function history(req, res) {
  const messages = conversations.get(req.params.conversationId);
  if (!messages) return res.status(404).json({ success: false, error: 'Conversation not found' });
  res.json({ success: true, conversationId: req.params.conversationId, messages });
}

module.exports = { chat, history, conversations };
