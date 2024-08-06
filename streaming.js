const EventEmitter = require('events');

class StreamingError extends Error {
  constructor(message, step, originalError = null) {
    super(message);
    this.name = 'StreamingError';
    this.step = step;
    this.originalError = originalError;
  }
}

function createLogger(options) {
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

module.exports = function createStreaming(options = {}) {
  const defaultOptions = {
    timeout: 30000,
    bufferSize: 1000,
    logLevel: 'info'
  };

  const config = { ...defaultOptions, ...options };
  const logger = createLogger(config);

  return async function* streaming(pipeline) {
    const context = {};
    const emitter = new EventEmitter();

    if (pipeline.length === 0) {
      logger.warn('Empty pipeline provided');
      return;
    }

    let state = context.state = [undefined];
    let stepIndex = 0;

    try {
      for (const step of pipeline) {
        logger.info(`Processing step ${stepIndex}`);
        validateStep(step);
        
        const processingPromise = processStep(step, state);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new StreamingError(`Step ${stepIndex} timed out`, stepIndex)), config.timeout)
        );

        try {
          state = await Promise.race([processingPromise, timeoutPromise]);
        } catch (error) {
          if (error instanceof StreamingError) {
            throw error; // Rethrow StreamingErrors (including timeout errors) directly
          }
          throw new StreamingError(`Error in step ${stepIndex}`, stepIndex, error);
        }

        stepIndex++;

        if (emitter.listenerCount('data') > 0) {
          for (const item of state) {
            emitter.emit('data', item);
          }
        }

        if (state.length > config.bufferSize) {
          logger.debug(`Buffer size exceeded. Current size: ${state.length}`);
          yield* state.splice(0, state.length - config.bufferSize);
        }
      }

      if (typeof state == 'string') {
        yield state;
      } else if (typeof state[Symbol.asyncIterator] === 'function') {
        for await (const item of state) {
          yield item;
        }
      } else if (typeof state[Symbol.iterator] === 'function') {
        for (const item of state) {
          yield item;
        }
      } else {
        yield state;
      }
      
    } catch (error) {
      logger.error('Error in streaming pipeline:', error);
      emitter.emit('error', error);
      throw error;
    } finally {
      logger.info('Streaming pipeline completed');
      emitter.emit('end');
    }

    function validateStep(step) {

      return true;


      if (!(Array.isArray(step) || typeof step === 'function')) {
        throw new StreamingError('Invalid pipeline step', stepIndex);
      }
    }

    async function processStep(step, input) {
      try {
        if (Array.isArray(step)) {
          return await processParallel(step, input);
        } else if (isGenerator(step)) {
          return await processGenerator(step, input);
        } else if (typeof step === 'function') {
          return await processFunction(step, input);
        } else {
          return step;
        }
      } catch (error) {
        throw new StreamingError('Error processing step', stepIndex, error);
      }
    }

    async function processParallel(steps, input) {
      return await Promise.all(input.map(async item => {
        const results = await Promise.all(steps.map(async step => {
          if (Array.isArray(step)) {
            return await processParallel(step, [item]);
          } else {
            return await processStep(step, [item]);
          }
        }));
        return results.flat();
      }));
    }

    async function processGenerator(gen, input) {
      let results = [];
      for (const item of input) {
        const generator = gen.call(context, item);
        for await (const result of generator) {
          results.push(result);
        }
      }
      return results;
    }

    async function processFunction(fn, input) {
      if (input.length === 1) {
        const result = await fn.call(context, input[0]);
        return [result];
      } else {
        const result = await fn.call(context, input);
        return Array.isArray(result) ? result : [result];
      }
    }
  }

  function isGenerator(fn) {
    return fn.constructor.name === 'GeneratorFunction' || 
           fn.constructor.name === 'AsyncGeneratorFunction';
  }
};