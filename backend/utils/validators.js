function validateQuestion(body) {
  if (!body || typeof body.question !== 'string' || !body.question.trim()) {
    const error = new Error('Question is required'); error.statusCode = 400; throw error;
  }
  if (body.question.length > 4000) {
    const error = new Error('Question must be 4000 characters or fewer'); error.statusCode = 400; throw error;
  }
  if (body.documentIds && !Array.isArray(body.documentIds)) {
    const error = new Error('documentIds must be an array'); error.statusCode = 400; throw error;
  }
  return body.question.trim();
}

module.exports = { validateQuestion };
