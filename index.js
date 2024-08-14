const EventEmitter = require('events');

class StreamOpsError extends Error {
  constructor(message, step, originalError = null) {
    super(message);
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

    async function processStep(step, input) {
      try {
        let lastYieldTime = Date.now();
        let hasYielded = false;

        const checkYieldTimeout = setInterval(() => {
          if (Date.now() - lastYieldTime > config.yieldTimeout) {
            logger.warn(`Step ${stepIndex} has not yielded for ${config.yieldTimeout}ms`);
          }
        }, config.yieldTimeout);

        const onYield = () => {
          hasYielded = true;
          lastYieldTime = Date.now();
        };

        let result;
        if (Array.isArray(step)) {
          result = await processParallel(step, input);
        } else if (isGenerator(step)) {
          result = await processGenerator(step, input, onYield);
        } else if (typeof step === 'function') {
          result = await processFunction(step, input);
        } else if (isComplexIterable(step)) {
          result = await processGenerator(async function*() {
            yield* await (step[Symbol.iterator] || step[Symbol.asyncIterator])
              ? step
              : [step]
          }, input, onYield);
        } else {
          result = step;
        }

        clearInterval(checkYieldTimeout);
        return result;
      } catch (error) {
        throw new StreamOpsError('Error processing step', stepIndex, error);
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

    async function processGenerator(gen, input, onYield) {
      let results = [];
      for await (const item of input) {
        const generator = gen.call(context, item);
        for await (const result of generator) {
          results.push(result);
          if (onYield) onYield();
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

    function isGenerator(fn) {
      return fn.constructor.name === 'GeneratorFunction' || 
             fn.constructor.name === 'AsyncGeneratorFunction';
    }

    try {
      for (const step of pipeline) {
        logger.info(`Processing step ${stepIndex}`);
        validateStep(step);
        
        const processingPromise = processStep(step, state);
      
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new StreamOpsError(`Step ${stepIndex} timed out`, stepIndex)), config.timeout)
        );

        try {
          state = await Promise.race([processingPromise, timeoutPromise]);
        } catch (error) {
          if (error instanceof StreamOpsError) {
            throw error;
          }
          throw new StreamOpsError(`Error in step ${stepIndex}`, stepIndex, error);
        }

        stepIndex++;

        if (emitter.listenerCount('data') > 0) {
          for (const item of state) {
            emitter.emit('data', item);
          }
        }

        if (state.length > config.bufferSize) {
          logger.debug(`Buffer size exceeded. Current size: ${state.length}`);
          for (const item of state.splice(0, state.length - config.bufferSize)) {
            yield item;
            lastDownstreamYield = Date.now();
            downstreamTimeoutWarningIssued = false;
          }
        }
      }

      if (typeof state == 'string') {
        yield state;
        lastDownstreamYield = Date.now();
        downstreamTimeoutWarningIssued = false;
      } else if (typeof state[Symbol.asyncIterator] === 'function') {
        for await (const item of state) {
          yield item;
          lastDownstreamYield = Date.now();
          downstreamTimeoutWarningIssued = false;
        }
      } else if (typeof state[Symbol.iterator] === 'function') {
        for (const item of state) {
          yield item;
          lastDownstreamYield = Date.now();
          downstreamTimeoutWarningIssued = false;
        }
      } else {
        yield state;
        lastDownstreamYield = Date.now();
        downstreamTimeoutWarningIssued = false;
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