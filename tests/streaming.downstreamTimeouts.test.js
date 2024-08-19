const createStreamOps = require('../src/createStreamOps.js');

jest.setTimeout(10000); // Increase Jest's default timeout

describe('DownstreamTimeout Tests', () => {
  let mockWarn;
  let realSetTimeout;
  let now;

  beforeEach(() => {
    mockWarn = jest.fn();
    console.warn = mockWarn;
    realSetTimeout = setTimeout;
    now = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('downstreamTimeout warning triggered for long pause in pipeline output', async () => {
    jest.useFakeTimers();
    const streaming = createStreamOps({ 
      downstreamTimeout: 100,
      logLevel: 'warn'
    });
    
    const pipeline = [
      async function* () {
        yield 1;
        yield 2;
        await new Promise(resolve => realSetTimeout(resolve, 150));
        yield 3;
      },
      async function* (num) {
        yield num * 2;
      }
    ];

    const results = [];
    const streamingIterator = streaming(pipeline);

    results.push((await streamingIterator.next()).value);
    results.push((await streamingIterator.next()).value);

    jest.advanceTimersByTime(110); // Advance just past the timeout
    await new Promise(resolve => realSetTimeout(resolve, 0));

    jest.advanceTimersByTime(200); // Advance the remaining time
    await new Promise(resolve => realSetTimeout(resolve, 0));

    results.push((await streamingIterator.next()).value);

    expect(results).toEqual([2, 4, 6]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[WARN\]/),
      expect.stringContaining('No data received downstream for 100ms')
    );
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });

  test('downstreamTimeout warning not triggered for quick pipeline output', async () => {
    const streaming = createStreamOps({ 
      downstreamTimeout: 100,
      logLevel: 'warn'
    });
    const pipeline = [
      async function* () {
        yield 1;
        yield 2;
        yield 3;
      },
      async function* (num) {
        yield num * 2;
      }
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([2, 4, 6]);
    expect(mockWarn).not.toHaveBeenCalledWith(
      expect.stringMatching(/No data received downstream for 100ms/)
    );
  });

  test('downstreamTimeout warning triggered only once for extended pause', async () => {
    jest.useFakeTimers();
    const streaming = createStreamOps({ 
      downstreamTimeout: 100,
      logLevel: 'warn'
    });
    
    const pipeline = [
      async function* () {
        yield 1;
        await new Promise(resolve => realSetTimeout(resolve, 250));
        yield 2;
      },
      async function* (num) {
        yield num * 2;
      }
    ];

    const results = [];
    const streamingIterator = streaming(pipeline);

    // Consume first item
    results.push((await streamingIterator.next()).value);

    // Advance timers and wait for all timers
    jest.advanceTimersByTime(250);
    await new Promise(resolve => realSetTimeout(resolve, 0));

    // Consume last item
    results.push((await streamingIterator.next()).value);

    expect(results).toEqual([2, 4]);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[WARN\]/),
      expect.stringContaining('No data received downstream for 100ms')
    );
  });

  test('downstreamTimeout respects custom timeout value', async () => {
    jest.useFakeTimers();
    const streaming = createStreamOps({ 
      downstreamTimeout: 200,
      logLevel: 'warn'
    });
    
    const pipeline = [
      async function* () {
        yield 1;
        await new Promise(resolve => realSetTimeout(resolve, 150));
        yield 2;
      },
      async function* (num) {
        yield num * 2;
      }
    ];

    const results = [];
    const streamingIterator = streaming(pipeline);

    // Consume first item
    results.push((await streamingIterator.next()).value);

    // Advance timers and wait for all timers
    jest.advanceTimersByTime(150);
    await new Promise(resolve => realSetTimeout(resolve, 0));

    // Consume last item
    results.push((await streamingIterator.next()).value);

    expect(results).toEqual([2, 4]);
    expect(mockWarn).not.toHaveBeenCalled();
  });


  test('downstreamTimeout warning resets after new output', async () => {
    jest.useFakeTimers();
    const streaming = createStreamOps({ 
      downstreamTimeout: 100,
      logLevel: 'warn'
    });
    
    const pipeline = [
      async function* () {
        yield 1;
        await new Promise(resolve => realSetTimeout(resolve, 150));
        yield 2;
        await new Promise(resolve => realSetTimeout(resolve, 150));
        yield 3;
      },
      async function* (num) {
        yield num * 2;
      }
    ];

    const results = [];
    const streamingIterator = streaming(pipeline);

    results.push((await streamingIterator.next()).value);

    jest.advanceTimersByTime(200);
    await new Promise(resolve => realSetTimeout(resolve, 0));

    jest.advanceTimersByTime(200);
    await new Promise(resolve => realSetTimeout(resolve, 0));

    results.push((await streamingIterator.next()).value);

    jest.advanceTimersByTime(200);
    await new Promise(resolve => realSetTimeout(resolve, 0));

    jest.advanceTimersByTime(200);
    await new Promise(resolve => realSetTimeout(resolve, 0));

    results.push((await streamingIterator.next()).value);

    expect(results).toEqual([2, 4, 6]);
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });

  test('downstreamTimeout works with empty pipeline', async () => {
    const streaming = createStreamOps({ 
      downstreamTimeout: 100,
      logLevel: 'warn'
    });
    const pipeline = [];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\] \[WARN\]/),
      'Empty pipeline provided'
    );
  });
});