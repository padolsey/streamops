const createStreamOps = require('../src/createStreamOps');

describe('MergeAggregate Operator', () => {
  let streamOps;

  beforeEach(() => {
    streamOps = createStreamOps();
  });

  test('In-pipeline mergeAggregate with intermediary results', async () => {
    const pipeline = [
      function* () {
        yield { id: 'james', age: 22 };
        yield { id: 'bob', location: 'london' };
        yield { location: ['berlin', 'washington'] };
      },
      streamOps.mergeAggregate()
    ];

    const expectedStates = [
      { id: ['james'], age: [22] },
      { id: ['james', 'bob'], age: [22], location: ['london'] },
      { id: ['james', 'bob'], age: [22], location: ['london', 'berlin', 'washington'] }
    ];

    let index = 0;
    for await (const item of streamOps(pipeline)) {
      expect(item).toEqual(expectedStates[index]);
      index++;
    }

    expect(index).toBe(expectedStates.length);
  });

  test('Chaining mergeAggregate', async () => {
    const stream = streamOps(function* () {
      yield { id: 'james', age: 22 };
      yield { id: 'bob', location: 'london' };
      yield { location: ['berlin', 'washington'] };
    }).mergeAggregate();

    const expectedStates = [
      { id: ['james'], age: [22] },
      { id: ['james', 'bob'], age: [22], location: ['london'] },
      { id: ['james', 'bob'], age: [22], location: ['london', 'berlin', 'washington'] }
    ];

    let index = 0;
    for await (const item of stream) {
      expect(item).toEqual(expectedStates[index]);
      index++;
    }

    expect(index).toBe(expectedStates.length);
  });

  test('MergeAggregate with removeDuplicates option set to false', async () => {
    const pipeline = [
      function* () {
        yield { id: 'james', age: 22 };
        yield { id: 'james', age: 22 };
        yield { location: ['london', 'london'] };
      },
      streamOps.mergeAggregate({ removeDuplicates: false })
    ];

    const expectedStates = [
      { id: ['james'], age: [22] },
      { id: ['james', 'james'], age: [22, 22] },
      { id: ['james', 'james'], age: [22, 22], location: ['london', 'london'] }
    ];

    let index = 0;
    for await (const item of streamOps(pipeline)) {
      expect(item).toEqual(expectedStates[index]);
      index++;
    }

    expect(index).toBe(expectedStates.length);
  });

  test('MergeAggregate with complex nested objects', async () => {
    const pipeline = [
      function* () {
        yield { user: { id: 1, name: 'Alice' }, scores: [10, 20] };
        yield { user: { id: 2, name: 'Bob' }, scores: [15, 25] };
        yield { user: { id: 1, name: 'Alice' }, scores: [30] };
      },
      streamOps.mergeAggregate()
    ];

    const expectedStates = [
      { user: [{ id: 1, name: 'Alice' }], scores: [10, 20] },
      { user: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }], scores: [10, 20, 15, 25] },
      { user: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }], scores: [10, 20, 15, 25, 30] }
    ];

    let index = 0;
    for await (const item of streamOps(pipeline)) {
      expect(item).toEqual(expectedStates[index]);
      index++;
    }

    expect(index).toBe(expectedStates.length);
  });

  test('MergeAggregate with empty input', async () => {
    const pipeline = [
      function* () {},
      streamOps.mergeAggregate()
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([]);
  });

  test('MergeAggregate with single input', async () => {
    const pipeline = [
      function* () {
        yield { id: 'alice', score: 100 };
      },
      streamOps.mergeAggregate()
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      { id: ['alice'], score: [100] }
    ]);
  });

  test('MergeAggregate with mixed data types', async () => {
    const pipeline = [
      function* () {
        yield { id: 1, name: 'Alice', tags: ['student'] };
        yield { id: '2', name: 'Bob', active: true };
        yield { id: 3, score: 95.5, tags: ['honor'] };
      },
      streamOps.mergeAggregate()
    ];

    const expectedStates = [
      { id: [1], name: ['Alice'], tags: ['student'] },
      { id: [1, '2'], name: ['Alice', 'Bob'], tags: ['student'], active: [true] },
      { id: [1, '2', 3], name: ['Alice', 'Bob'], tags: ['student', 'honor'], active: [true], score: [95.5] }
    ];

    let index = 0;
    for await (const item of streamOps(pipeline)) {
      expect(item).toEqual(expectedStates[index]);
      index++;
    }
    expect(index).toBe(expectedStates.length);
  });
});