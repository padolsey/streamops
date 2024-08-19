module.exports = function createLogger(options) {
  const logLevels = ['error', 'warn', 'info', 'debug'];
  const logLevel = options.logLevel || 'info';
  const logLevelIndex = logLevels.indexOf(logLevel);

  return logLevels.reduce((logger, level) => {
    const levelIndex = logLevels.indexOf(level);
    logger[level] = (...args) => {
      if (levelIndex <= logLevelIndex) {
        console[level](`[${new Date().toISOString()}] [${level.toUpperCase()}]`, ...args);
      }
    };
    return logger;
  }, {});
}