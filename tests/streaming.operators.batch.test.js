const createStreamOps = require('../src/createStreamOps');

describe('Batch Operator', () => {
  let streamOps;

  beforeEach(() => {
    streamOps = createStreamOps();
  });

  test('basic batching with incomplete batch yielding', async () => {
    const pipeline = [
      function* () {
        yield 1; yield 2; yield 3; yield 4; yield 5;
      },
      streamOps.batch(2, {yieldIncomplete: true})
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([[1,2], [3,4], [5]]);
  });

  test('basic batching with incomplete batch yielding', async () => {
    const pipeline = [
      function* () {
        yield 1; yield 2; yield 3; yield 4; yield 5;
      },
      streamOps.batch(2, {yieldIncomplete: true})
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([[1,2], [3,4], [5]]);
  });

  test('basic batching without incomplete batch yielding', async () => {
    const pipeline = [
      function* () {
        yield 1; yield 2; yield 3; yield 4; yield 5;
      },
      streamOps.batch(2, {yieldIncomplete: false})
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([[1,2], [3,4]]);
  });

  test('maintains batch state between yields', async () => {
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
      },
      streamOps.batch(2)  // default yieldIncomplete: true
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([[1,2], [3,4]]);
  });

  test('handles empty input', async () => {
    const pipeline = [
      function* () {
        // yields nothing
      },
      streamOps.batch(2)
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([]);
  });

  test('handles batch size of 1', async () => {
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
        yield 3;
      },
      streamOps.batch(1)
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([[1], [2], [3]]);
  });

  test('handles large batch size with incomplete batches dropped', async () => {
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
        yield 3;
      },
      streamOps.batch(5, {yieldIncomplete: false})
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([]);  // Nothing yielded as batch never fills
  });

  test('batch operator properly handles END_SIGNAL with array spreading', async () => {
    const streamOps = createStreamOps();
    
    const pipeline = [
      // Step 1: Generate initial array
      function* () {
        yield [1, 2, 3];
      },

      // Step 2: Spread array items individually
      function* (items) {
        for (const item of items) {
          yield item;
        }
      },

      // Step 3: Batch items
      streamOps.batch(2, { yieldIncomplete: true }),

      // Step 4: Log batches (optional)
      function* (batch) {
        console.log('Batch:', batch);
        yield batch;
      }
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      console.log('Result:', item);
      results.push(item);
    }

    console.log('Final Results:', results);
    expect(results).toEqual([[1, 2], [3]]);
  });
}); 