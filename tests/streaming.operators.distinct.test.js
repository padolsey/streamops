const createStreamOps = require('../src/createStreamOps');

describe('Distinct Operator', () => {
  let streamOps;

  beforeEach(() => {
    streamOps = createStreamOps();
  });

  test('custom equality function', async () => {
    const pipeline = [
      function* () {
        yield {id: 1}; 
        yield {id: 1}; 
        yield {id: 2};
      },
      streamOps.distinct((a, b) => a.id === b.id)
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      {id: 1},
      {id: 2}
    ]);
  });

  test('default equality', async () => {
    const pipeline = [
      function* () {
        yield 1;
        yield 1;
        yield 2;
        yield 2;
        yield 1;
      },
      streamOps.distinct()
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 2]);
  });

  test('distinct with objects using default equality', async () => {
    const obj = {x: 1};
    const pipeline = [
      function* () {
        yield obj;
        yield obj;  // Same reference
        yield {x: 1};  // Different reference but same content
      },
      streamOps.distinct()
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toHaveLength(2);  // Should keep obj and the new {x: 1}
    expect(results[0]).toBe(obj);     // First should be original reference
    expect(results[1]).toEqual({x: 1}); // Second should be the new object
  });
}); 