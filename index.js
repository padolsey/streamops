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

    let state = context.state = [undefined];
    let stepIndex = 0;
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

    async function* processStep(step, input) {
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

        const processingPromise = (async function*() {
          if (Array.isArray(step)) {
            yield* processParallel(step, input);
          } else if (isGenerator(step)) {
            yield* processGenerator(step, input, onYield);
          } else if (typeof step === 'function') {
            yield* await withTimeout(processFunction(step, input), config.timeout, `Step ${stepIndex} timed out`);
          } else if (isComplexIterable(step)) {
            yield* processGenerator(async function*() {
              yield* await (step[Symbol.iterator] || step[Symbol.asyncIterator])
                ? step
                : [step]
            }, input, onYield);
          } else {
            yield step;
          }
        })();

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Step ${stepIndex} timed out`)), config.timeout);
        });

        yield* race(processingPromise, timeoutPromise);

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
      const inputArray = [];
      for await (const item of input) {
        inputArray.push(item);
      }

      const processors = inputArray.map(async (item) => {
        const results = [];
        for (const step of steps) {
          if (Array.isArray(step)) {
            for await (const result of processParallel(step, [item])) {
              results.push(result);
            }
          } else {
            for await (const result of processStep(step, [item])) {
              results.push(result);
            }
          }
        }
        return results;
      });

      const iterator = processors[Symbol.iterator]();
      let result = iterator.next();
      while (!result.done) {
        const processor = await result.value;
        for (const item of processor) {
          yield item;
        }
        result = iterator.next();
      }
    }

    async function* processGenerator(gen, input, onYield) {
      for await (const item of input) {
        const generator = gen.call(context, item);
        for await (const result of generator) {
          yield result;
          if (onYield) onYield();
        }
      }
    }

    async function processFunction(fn, input) {
      const inputArray = [];
      for await (const item of input) {
        inputArray.push(item);
      }
      const result = await fn.call(context, inputArray);
      return Array.isArray(result) ? result : [result];
    }

    function isGenerator(fn) {
      return fn.constructor.name === 'GeneratorFunction' || 
             fn.constructor.name === 'AsyncGeneratorFunction';
    }

    try {
      for (const step of pipeline) {
        logger.info(`Processing step ${stepIndex}`);
        validateStep(step);
        
        const processingGenerator = processStep(step, state);

        try {
          state = [];  // Reset state for collecting items from this step
          for await (const item of processingGenerator) {
            if (stepIndex === pipeline.length - 1) {
              // If it's the last step, yield the item to the consumer
              yield item;
            } else {
              // Otherwise, collect the item for the next step
              state.push(item);
            }
            lastDownstreamYield = Date.now();
            downstreamTimeoutWarningIssued = false;
            
            if (emitter.listenerCount('data') > 0) {
              emitter.emit('data', item);
            }
          }
        } catch (error) {
          if (error instanceof StreamOpsError) {
            throw error;
          }
          throw new StreamOpsError(`Error in step ${stepIndex}`, stepIndex, error);
        }

        stepIndex++;
      }
      
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