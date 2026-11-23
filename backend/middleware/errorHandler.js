function notFound(req, res) {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.statusCode || error.status || 500;
  const publicMessage = status >= 500 ? 'An unexpected server error occurred' : error.message;
  if (status >= 500) console.error(error);
  res.status(status).json({ success: false, error: publicMessage });
}

module.exports = { notFound, errorHandler };
