const createStreamOps = require('../src/createStreamOps.js');

describe('YieldTimeout Tests', () => {
  let originalConsoleWarn;
  let originalConsoleError;
  let mockWarn;
  let mockError;

  beforeEach(() => {
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    mockWarn = jest.fn();
    mockError = jest.fn();
    console.warn = mockWarn;
    console.error = mockError;
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  test('No warning for fast yielding step', async () => {
    const streaming = createStreamOps({ yieldTimeout: 1000 });
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
        yield 3;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 2, 3]);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  test('Warning logged for slow yielding step', async () => {
    const streaming = createStreamOps({ yieldTimeout: 5, logLevel: 'warn' });
    const pipeline = [
      async function* () {
        yield 1;
        await new Promise(resolve => setTimeout(resolve, 30));
        yield 2;
        await new Promise(resolve => setTimeout(resolve, 30));
        yield 3;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 2, 3]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[WARN\]/),
      expect.stringMatching(/Step 1 has not yielded for 5ms/)
    );
    expect(mockWarn.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  test('Yield-null behavior', async () => {
    const streaming = createStreamOps({ yieldTimeout: 10, yieldTimeoutBehavior: 'yield-null', logLevel: 'warn' });
    const pipeline = [
      async function* () {
        yield 1;
        await new Promise(resolve => setTimeout(resolve, 50));
        yield 2;
        await new Promise(resolve => setTimeout(resolve, 50));
        yield 3;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toContain(null);
    expect(results).toEqual([1, null, 2, null, 3]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[WARN\]/),
      expect.stringMatching(/Step 1 timed out, yielding null/)
    );
  });

  test('Cancel behavior', async () => {
    const streaming = createStreamOps({ yieldTimeout: 10, yieldTimeoutBehavior: 'cancel', logLevel: 'error' });
    const pipeline = [
      async function* () {
        yield 1;
        await new Promise(resolve => setTimeout(resolve, 30));
        yield 2;
      }
    ];

    await expect(async () => {
      const results = [];
      try {
        for await (const item of streaming(pipeline)) {
          results.push(item);
        }
      } catch (error) {
        throw error; // Re-throw the error to be caught by the expect
      }
    }).rejects.toThrow('Step 1 timed out');

    expect(mockError).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[ERROR\]/),
      expect.stringMatching(/Step 1 timed out, cancelling pipeline/)
    );
  });

  test('Block behavior', async () => {
    const streaming = createStreamOps({ yieldTimeout: 10, yieldTimeoutBehavior: 'block', logLevel: 'warn' });
    const pipeline = [
      async function* () {
        yield 1;
        await new Promise(resolve => setTimeout(resolve, 50));
        yield 2;
        yield 3;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[WARN\]/),
      expect.stringMatching(/Step 1 timed out, blocking future yields/)
    );
  });

  test('Unknown behavior defaults to warn', async () => {
    const streaming = createStreamOps({ yieldTimeout: 50, yieldTimeoutBehavior: 'unknown', logLevel: 'warn' });
    const pipeline = [
      async function* () {
        yield 1;
        await new Promise(resolve => setTimeout(resolve, 200));
        yield 2;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 2]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[WARN\]/),
      expect.stringMatching(/Unknown yieldTimeoutBehavior: unknown. Defaulting to 'warn'/)
    );
  });

  test('Timeout behavior with complex iterable', async () => {
    const streaming = createStreamOps({ yieldTimeout: 50, yieldTimeoutBehavior: 'yield-null', logLevel: 'warn' });
    const pipeline = [
      {
        [Symbol.asyncIterator]: async function* () {
          yield 1;
          await new Promise(resolve => setTimeout(resolve, 200));
          yield 2;
          await new Promise(resolve => setTimeout(resolve, 200));
          yield 3;
        }
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toContain(null);
    expect(results).toEqual([1, null, 2, null, 3]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[WARN\]/),
      expect.stringMatching(/Step 1 timed out, yielding null/)
    );
  });

  test('Timeout behavior with regular function', async () => {
    const streaming = createStreamOps({ yieldTimeout: 50, yieldTimeoutBehavior: 'warn', logLevel: 'warn' });
    const pipeline = [
      async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 42;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([42]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[WARN\]/),
      expect.stringMatching(/Step 1 has not yielded for 50ms/)
    );
  });

});