function errorHandler(err, req, res, next) {
  console.error('[Global Error Handler]:', err);
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';
  res.status(statusCode).json({
    status: err.status || 'error',
    message,
  });
}

module.exports = errorHandler;