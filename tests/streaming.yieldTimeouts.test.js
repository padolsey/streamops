const createStreamOps = require('../index.js');

describe('YieldTimeout Tests', () => {
  let originalConsoleWarn;
  let mockWarn;

  beforeEach(() => {
    originalConsoleWarn = console.warn;
    mockWarn = jest.fn();
    console.warn = mockWarn;
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
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
    const streaming = createStreamOps({ yieldTimeout: 50 });
    const pipeline = [
      async function* () {
        yield 1;
        await new Promise(resolve => setTimeout(resolve, 200));
        yield 2;
        await new Promise(resolve => setTimeout(resolve, 200));
        yield 3;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 2, 3]);
    console.log(mockWarn.mock.calls.join(','))
    expect(
      /Step 1 has not yielded for 50ms/
        .test(
          mockWarn.mock.calls.join(',')
        )
      ).toEqual(true)
    // Remember timeout executions are fuzzy depending on runtime
    // it's hard to make solid determinisms 
    expect(mockWarn.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  test('No warning for step that completes quickly', async () => {
    const streaming = createStreamOps({ yieldTimeout: 1000 });
    const pipeline = [
      () => [1, 2, 3]
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results.flat()).toEqual([1, 2, 3]);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  test('Warning logged for step that takes too long without yielding', async () => {
    const streaming = createStreamOps({ yieldTimeout: 100 });
    const pipeline = [
      async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return [1, 2, 3];
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results.flat()).toEqual([1, 2, 3]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[WARN\]/),
      "Step 1 has not yielded for 100ms"
    );
  });

  test('Multiple warnings for step with multiple long pauses', async () => {
    const streaming = createStreamOps({ yieldTimeout: 50 });
    const pipeline = [
      async function* () {
        yield 1;
        await new Promise(resolve => setTimeout(resolve, 150));
        yield 2;
        await new Promise(resolve => setTimeout(resolve, 150));
        yield 3;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 2, 3]);
    expect(mockWarn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('No warning for complex iterable that yields quickly', async () => {
    const streaming = createStreamOps({ yieldTimeout: 1000 });
    const pipeline = [
      {
        [Symbol.asyncIterator]: async function* () {
          yield 1;
          yield 2;
          yield 3;
        }
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 2, 3]);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  test('Warning for complex iterable with slow yields', async () => {
    const streaming = createStreamOps({ yieldTimeout: 50 });
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

    expect(results).toEqual([1, 2, 3]);
    expect(mockWarn.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});