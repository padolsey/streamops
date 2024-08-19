const streaming = require('../src/createStreamOps.js')({ timeout: 30000, bufferSize: 1000, logLevel: 'info' });

describe('Generator objects and async operations', () => {
  test('Handles generator objects', async () => {
    function* generatorFunction() {
      yield 1;
      yield 2;
      yield 3;
    }
    
    const generatorObject = generatorFunction();
    
    const pipeline = [
      generatorObject,
      function*(x) { yield x * 2; }
    ];
    
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    
    expect(results).toEqual([2, 4, 6]);
  });

  test('Handles async generator objects', async () => {
    async function* asyncGeneratorFunction() {
      yield await Promise.resolve(1);
      yield await Promise.resolve(2);
      yield await Promise.resolve(3);
    }
    
    const asyncGeneratorObject = asyncGeneratorFunction();
    
    const pipeline = [
      asyncGeneratorObject,
      async function*(x) { yield await Promise.resolve(x * 2); }
    ];
    
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    
    expect(results).toEqual([2, 4, 6]);
  });

  test('Mixes sync and async generator operations', async () => {
    function* syncGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    const pipeline = [
      syncGenerator(),
      async function*(x) { yield await Promise.resolve(x * 2); },
      function*(x) { yield x + 1; }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([3, 5, 7]);
  });

  test('Handles nested generators', async () => {
    function* innerGenerator() {
      yield 2;
      yield 3;
    }

    function* outerGenerator() {
      yield 1;
      yield* innerGenerator();
      yield 4;
    }

    const pipeline = [
      outerGenerator(),
      function*(x) { yield x * 2; }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([2, 4, 6, 8]);
  });

  test('Processes large amount of data without blocking', async () => {
    function* largeDataGenerator() {
      for (let i = 0; i < 999; i++) {
        yield i;
      }
    }

    const pipeline = [
      largeDataGenerator(),
      function*(x) { yield x + 1; },
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results.length).toBe(999);
    expect(results[0]).toBe(1);
    expect(results[results.length - 1]).toBe(999);
  });

  test('Handles errors in generator', async () => {
    function* errorGenerator() {
      yield 1;
      throw new Error('Generator error');
    }

    const pipeline = [
      errorGenerator(),
      function*(x) { yield x * 2; }
    ];

    await expect(async () => {
      for await (const item of streaming(pipeline)) {
        // consume the stream
      }
    }).rejects.toThrow('Generator error');
  });

  test('Handles async errors', async () => {
    const pipeline = [
      async function* () {
        yield 1;
        await Promise.reject(new Error('Async error'));
      },
      function*(x) { yield x * 2; }
    ];

    await expect(async () => {
      for await (const item of streaming(pipeline)) {
        // consume the stream
      }
    }).rejects.toThrow('Async error');
  });

  test('Handles multiple yields in pipeline steps', async () => {
    const pipeline = [
      function*() { yield 1; yield 2; yield 3; },
      function*(x) { yield x; yield x * 2; },
      function*(x) { yield x + 1; }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([2, 3, 3, 5, 4, 7]);
  });
});