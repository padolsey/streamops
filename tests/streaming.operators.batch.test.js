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

    expect(results).toEqual([[1,2], [3,4]]);
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

    expect(results).toEqual([[1,2], [3,4]]);  // [5] is dropped
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
}); 