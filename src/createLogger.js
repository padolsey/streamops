module.exports = function createLogger(options) {
  const logLevels = ['error', 'warn', 'info', 'debug', 'dev'];
  const logLevel = options.logLevel || 'info';
  const logLevelIndex = logLevels.indexOf(logLevel);
  const isDevelopment = process.env.NODE_ENV === 'development';

  return logLevels.reduce((logger, level) => {
    const levelIndex = logLevels.indexOf(level);
    logger[level] = (...args) => {
      if (levelIndex <= logLevelIndex && (level !== 'dev' || isDevelopment)) {
        (console[level] || console.log)(`[${new Date().toISOString()}] [${level.toUpperCase()}]`, ...args);
      }
    };
    return logger;
  }, {});
}