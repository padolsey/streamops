const EventEmitter = require('events');

class StreamOpsError extends Error {
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

module.exports = function createStreamOps(options = {}) {
  const defaultOptions = {
    timeout: 100000,
    bufferSize: 1000,
    logLevel: 'info',
    yieldTimeout: 20000,
    downstreamTimeout: 30000
  };

  const config = { ...defaultOptions, ...options };
  const logger = createLogger(config);

  async function* streaming(pipeline) {
    const context = pipeline;
    const emitter = new EventEmitter();

    if (pipeline.length === 0) {
      logger.warn('Empty pipeline provided');
      return;
    }

    let stepIndex = 1;
    let lastDownstreamYield = Date.now();
    let downstreamTimeoutWarningIssued = false;

    const checkDownstreamTimeout = setInterval(() => {
      const timeSinceLastYield = Date.now() - lastDownstreamYield;
      if (timeSinceLastYield > config.downstreamTimeout && !downstreamTimeoutWarningIssued) {
        logger.warn(`No data received downstream for ${config.downstreamTimeout}ms`);
        downstreamTimeoutWarningIssued = true;
      }
    }, Math.min(config.downstreamTimeout, 1000));

    function validateStep(step) {
      return true;
    }

    async function* processStep(step, [input]) {
      try {
        let lastYieldTime = Date.now();

        const checkYieldTimeout = setInterval(() => {
          if (Date.now() - lastYieldTime > config.yieldTimeout) {
            logger.warn(`Step ${stepIndex} has not yielded for ${config.yieldTimeout}ms`);
          }
        }, config.yieldTimeout);

        const onYield = () => {
          lastYieldTime = Date.now();
        };

        if (Array.isArray(step)) {
          yield* processParallel(step, input);
        } else if (isGenerator(step)) {
          yield* processGenerator(step, input, onYield);
        } else if (typeof step === 'function') {
          yield* processFunction(step, [input]);
        } else if (isComplexIterable(step)) {
          yield* processGenerator(async function*() {
            yield* await (step[Symbol.iterator] || step[Symbol.asyncIterator])
              ? step
              : [step]
          }, input, onYield);
        } else {
          yield step;
        }

        clearInterval(checkYieldTimeout);
      } catch (error) {
        throw new StreamOpsError('Error processing step', stepIndex, error);
      }
    }

    async function* withTimeout(promise, ms, message) {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), ms);
      });

      try {
        const result = await Promise.race([promise, timeoutPromise]);
        yield* (Array.isArray(result) ? result : [result]);
      } catch (error) {
        throw error;
      }
    }

    async function* race(generatorPromise, timeoutPromise) {
      try {
        const generator = await Promise.race([generatorPromise, timeoutPromise]);
        yield* generator;
      } catch (error) {
        throw error;
      }
    }

    function isComplexIterable(obj) {
      return obj != null && 
        (
          typeof obj[Symbol.iterator] === 'function' ||
          typeof obj[Symbol.asyncIterator] === 'function'
        ) &&
          typeof obj !== 'string' &&
          typeof obj !== 'number' &&
          typeof obj !== 'boolean' &&
          typeof obj !== 'symbol';
    }

    async function* processParallel(steps, input) {
      for (const step of steps) {
        if (Array.isArray(step)) {
          yield* processParallel(step, input);
        } else {
          yield* processStep(step, [input]);
        }
      }
    }

    async function* processGenerator(gen, input, onYield) {
      const generator = gen.call(context, input);
      for await (const result of generator) {
        yield result;
        if (onYield) onYield();
      }
    }

    async function* processFunction(fn, input) {
      const inputArray = [];
      for await (const item of input) {
        inputArray.push(item);
      }
      const result = await fn.call(context, inputArray);
      yield* (Array.isArray(result) ? result : [result]);
    }

    function isGenerator(fn) {
      return fn.constructor.name === 'GeneratorFunction' || 
             fn.constructor.name === 'AsyncGeneratorFunction';
    }

    try {

      async function* processPipeline(input, stepIndex = 0) {
        if (stepIndex >= pipeline.length) {
          yield* input;
          return;
        }

        const step = pipeline[stepIndex];
        logger.info(`Processing step ${stepIndex}`);
        validateStep(step);

        for await (const item of input) {
          const processingGenerator = processStep(step, [item]);
          stepIndex++;
          for await (const result of processingGenerator) {
            yield* processPipeline([result], stepIndex);
          }
        }
      }

      yield* processPipeline([undefined]);
      
    } catch (error) {
      logger.error('Error in streaming pipeline:', error);
      emitter.emit('error', error);
      throw error;
    } finally {
      clearInterval(checkDownstreamTimeout);
      logger.info('Streaming pipeline completed');
      emitter.emit('end');
    }
  }

  return streaming;
};