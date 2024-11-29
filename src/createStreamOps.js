const {END_SIGNAL, NEEDS_END_SIGNAL} = require('./CONSTANTS');
const EventEmitter = require('events');
const {operators, Dam} = require('./operators');
const StreamOpsError = require('./StreamOpsError');
const StreamingChain = require('./StreamingChain');
const createLogger = require('./createLogger');

class TimeoutCancelError extends Error {
  constructor(stepIndex) {
    super(`Step ${stepIndex} timed out, cancelling pipeline`);
    this.name = 'TimeoutCancelError';
    this.stepIndex = stepIndex;
  }
}

function createStreamOps(options = {}) {
  const defaultOptions = {
    timeout: 100000,
    logLevel: 'error',
    yieldTimeout: 20000,
    downstreamTimeout: 30000,
    yieldTimeoutBehavior: 'warn'
  };

  const config = { ...defaultOptions, ...(options||{}) };
  const logger = createLogger(config);

  function handleYieldTimeout(stepIndex, lastYieldTime) {
    if (Date.now() - lastYieldTime <= config.yieldTimeout) {
      return { shouldContinue: true };
    }

    switch (config.yieldTimeoutBehavior) {
      case 'warn':
        logger.warn(`Step ${stepIndex} has not yielded for ${config.yieldTimeout}ms`);
        return { shouldContinue: true };
      case 'yield-null':
        logger.warn(`Step ${stepIndex} timed out, yielding null`);
        return { shouldContinue: true, valueToYield: null };
      case 'cancel':
        logger.error(`Step ${stepIndex} timed out, cancelling pipeline`);
        return { shouldContinue: false, cancel: true };
      case 'block':
        logger.warn(`Step ${stepIndex} timed out, blocking future yields`);
        return { shouldContinue: false };
      default:
        logger.warn(`Unknown yieldTimeoutBehavior: ${config.yieldTimeoutBehavior}. Defaulting to 'warn'`);
        return { shouldContinue: true };
    }
  }

  function splitArrayAt(arr, predicate) {
    const result = arr.reduce((acc, item, index, array) => {
      if (predicate(item, index, array)) {
        if (index <= array.length - 1) {
          acc.push([]);
        }
      } else {
        if (acc.length === 0) {
          acc.push([]);
        }
        acc[acc.length - 1].push(item);
      }
      return acc;
    }, []);
  
    return result;
  }

  async function* streaming(pipeline) {
    if (pipeline instanceof StreamingChain) {
      pipeline = pipeline.pipeline;
    }

    const context = pipeline;
    const emitter = new EventEmitter();

    const splits = splitArrayAt(pipeline, step => step instanceof Dam);
    let last;

    if (splits?.length > 1) {

      // If the pipeline has been split such that the last item
      // is an empty arr then we know its a dam:
      if (
        Array.isArray(splits[splits.length - 1]) &&
        splits[splits.length - 1].length === 0
      ) {
        splits[splits.length - 1] = [function*(x) {yield* x}]
      }

      for (const splitPipelinePart of splits) {
        const activePipelinePartStream = streaming([
          ...(last ? [function*() {yield last;}] : []),
          ...splitPipelinePart
        ]);
        const results = [];
        for await (const item of activePipelinePartStream) {
          results.push(item);
        }
        last = results;
      }
      yield*last;
      return;
    }

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
      // Always pass END_SIGNAL to operators marked with NEEDS_END_SIGNAL
      if (input === END_SIGNAL && !step[NEEDS_END_SIGNAL]) {
        yield END_SIGNAL; // Propagate end signal
        return;
      }

      let lastYieldTime = Date.now();
      let timeoutOccurred = false;
      let shouldCancel = false;
      let timeoutValue = undefined;

      const checkYieldTimeout = setInterval(() => {
        const { shouldContinue, valueToYield, cancel } = handleYieldTimeout(stepIndex, lastYieldTime);
        if (!shouldContinue) {
          clearInterval(checkYieldTimeout);
          timeoutOccurred = true;
        }
        if (cancel) {
          shouldCancel = true;
        }
        if (valueToYield !== undefined) {
          timeoutValue = valueToYield;
        }
      }, Math.min(config.yieldTimeout, 1000));

      const onYield = () => {
        lastYieldTime = Date.now();
      };

      async function* wrappedStep() {

        if (Array.isArray(step)) {
          yield* processParallel(step, input);
        } else if (isGenerator(step)) {
          yield* processGenerator(step, input, onYield);
        } else if (typeof step === 'function') {
          yield* processFunction(step, input);
        } else if (isComplexIterable(step)) {
          yield* processGenerator(async function*() {
            yield* await (step[Symbol.iterator] || step[Symbol.asyncIterator])
              ? step
              : [step]
          }, input, onYield);
        } else {
          yield step;
        }
      }

      try {
        for await (const item of wrappedStep()) {
          if (shouldCancel) {
            throw new TimeoutCancelError(stepIndex);
          }
          if (timeoutOccurred) {
            break;
          }
          if (timeoutValue !== undefined) {
            yield timeoutValue;
            timeoutValue = undefined;
          }
          yield item;
          onYield();
        }
      } finally {
        clearInterval(checkYieldTimeout);
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
      const result = await fn.call(context, input);
      yield result;
    }

    function isGenerator(fn) {
      return fn?.constructor?.name === 'GeneratorFunction' || 
             fn?.constructor?.name === 'AsyncGeneratorFunction';
    }

    try {
      async function* processPipeline(input, stepIndex = 0) {

        // End of the pipeline!!!
        if (stepIndex >= pipeline.length) {
          // Only yield actual values at the end of pipeline
          for await (const item of input) {
            if (item !== END_SIGNAL) {
              yield item; // final "values" of the pipeline
            }
          }
          return;
        }

        const step = pipeline[stepIndex];
        logger.dev(`Processing step ${stepIndex}`);
        validateStep(step);

        const acc = [];
        for await (const item of input) {
          const processingGenerator = processStep(step, [item]);
          stepIndex++;
          for await (const result of processingGenerator) {
            yield* processPipeline([result], stepIndex);
          }
        }
        // Signal end of stream
        yield* processPipeline([END_SIGNAL], stepIndex);
      }

      yield* processPipeline([undefined]);
      
    } catch (error) {
      logger.error('Error in streaming pipeline:', error);
      emitter.emit('error', error);
      throw error;
    } finally {
      clearInterval(checkDownstreamTimeout);
      logger.dev('Streaming pipeline completed');
      emitter.emit('end');
    }
  }

  // Return a function that handles both array pipelines and chaining
  return Object.assign(
    function(initialPipeline) {
      if (Array.isArray(initialPipeline)) {
        return streaming(initialPipeline);
      } else {
        return new StreamingChain(initialPipeline, () => {
          return createStreamOps(options);
        });
      }
    },
    operators
  );
}

module.exports = createStreamOps;
createStreamOps.END_SIGNAL = END_SIGNAL;
createStreamOps.NEEDS_END_SIGNAL = NEEDS_END_SIGNAL;
