const createStreamer = require('../index');
const EventEmitter = require('events');

describe('streaming abstraction error handling', () => {
  let originalConsoleError;
  let consoleOutput = [];

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = (...args) => {
      consoleOutput.push(args.join(' '));
    };
    consoleOutput = [];
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  // test('handles and logs errors properly', async () => {
  //   const errorMessage = 'Test error in step';
  //   const streamingInstance = createStreamer({
  //     timeout: 1000,
  //     logLevel: 'error'
  //   });

  //   const pipeline = [
  //     function* () {
  //       yield 1;
  //       yield 2;
  //     },
  //     function () {
  //       throw new Error(errorMessage);
  //     },
  //     function (x) {
  //       return x * 2;
  //     }
  //   ];

  //   const errorHandler = jest.fn();
  //   const dataHandler = jest.fn();
  //   const endHandler = jest.fn();

  //   const emitter = new EventEmitter();
  //   emitter.on('error', errorHandler);
  //   emitter.on('data', dataHandler);
  //   emitter.on('end', endHandler);

  //   await expect(async () => {
  //     for await (const item of streamingInstance(pipeline)) {
  //       emitter.emit('data', item);
  //     }
  //   }).rejects.toThrow('Error in step 1');

  //   expect(errorHandler).toHaveBeenCalledTimes(1);
  //   expect(dataHandler).toHaveBeenCalledTimes(0);
  //   expect(endHandler).toHaveBeenCalledTimes(1);

  //   expect(consoleOutput.length).toBe(1);
  //   expect(consoleOutput[0]).toContain('[ERROR] Error in streaming pipeline:');
  //   expect(consoleOutput[0]).toContain(errorMessage);
  //   expect(consoleOutput[0]).toContain('step 1');
  // });

  test('handles timeouts properly', async () => {
    const streamingInstance = createStreamer({
      timeout: 100,
      logLevel: 'error'
    });

    const pipeline = [
      function* () {
        yield 1;
        yield 2;
      },
      async function() {
        await new Promise(resolve => setTimeout(resolve, 1000)); // This will timeout
        return 42;
      }
    ];

    await expect(async () => {
      for await (const item of streamingInstance(pipeline)) {
        // consume the stream
      }
    }).rejects.toThrow('Step 1 timed out');

    expect(consoleOutput.length).toBe(1);
    expect(consoleOutput[0]).toContain('[ERROR] Error in streaming pipeline:');
    expect(consoleOutput[0]).toContain('Step 1 timed out');
  });
});