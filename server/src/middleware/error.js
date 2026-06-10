function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.statusCode || error.status || 500;
  const response = {
    message: status === 500 ? 'Internal server error' : error.message
  };

  if (process.env.NODE_ENV !== 'production') {
    response.details = error.message;
  }

  console.error(error);
  return res.status(status).json(response);
}

module.exports = {
  notFound,
  errorHandler
};
