module.exports = class StreamOpsError extends Error {
  constructor(message, step, originalError = null) {
    super(
      message
      + (step ? ': Step ' + step : '')
      + (originalError ? ': Original Error: ' + originalError : '')
    );
    this.name = 'StreamOpsError';
    this.step = step;
    this.originalError = originalError;
  }
}