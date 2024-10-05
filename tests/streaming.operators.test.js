const createStreamOps = require('../src/createStreamOps');

describe('StreamOps - Operator Functionalities', () => {
  let streamOps;

  beforeEach(() => {
    streamOps = createStreamOps();
  });

  describe('Map Operator', () => {
    test('In-pipeline map', async () => {
      const pipeline = [
        function* () {
          yield 1;
          yield 2;
          yield 3;
        },
        streamOps.map(x => x * 2)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual([2, 4, 6]);
    });

    test('Chaining map', async () => {
      const stream = streamOps(function* () {
        yield 1;
        yield 2;
        yield 3;
      }).map(x => x * 2);

      const results = [];
      for await (const item of stream) {
        results.push(item);
      }

      expect(results).toEqual([2, 4, 6]);
    });

    test('Multiple maps in pipeline', async () => {
      const pipeline = [
        function* () {
          yield 1;
          yield 2;
          yield 3;
        },
        streamOps.map(x => x * 2),
        streamOps.map(x => x + 1)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual([3, 5, 7]);
    });

    test('Multiple chained maps', async () => {
      const stream = streamOps(function* () {
        yield 1;
        yield 2;
        yield 3;
      })
        .map(x => x * 2)
        .map(x => x + 1);

      const results = [];
      for await (const item of stream) {
        results.push(item);
      }

      expect(results).toEqual([3, 5, 7]);
    });
  });

  describe('Filter Operator', () => {
    test('In-pipeline filter', async () => {
      const pipeline = [
        function* () {
          yield 1;
          yield 2;
          yield 3;
          yield 4;
        },
        streamOps.filter(x => x % 2 === 0)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual([2, 4]);
    });

    test('Chaining filter', async () => {
      const stream = streamOps(function* () {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
      }).filter(x => x % 2 === 0);

      const results = [];
      for await (const item of stream) {
        results.push(item);
      }

      expect(results).toEqual([2, 4]);
    });

    test('Multiple filters in pipeline', async () => {
      const pipeline = [
        function* () {
          yield 1;
          yield 2;
          yield 3;
          yield 4;
          yield 5;
          yield 6;
        },
        streamOps.filter(x => x % 2 === 0),
        streamOps.filter(x => x > 2)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual([4, 6]);
    });

    test('Multiple chained filters', async () => {
      const stream = streamOps(function* () {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
        yield 5;
        yield 6;
      })
        .filter(x => x % 2 === 0)
        .filter(x => x > 2);

      const results = [];
      for await (const item of stream) {
        results.push(item);
      }

      expect(results).toEqual([4, 6]);
    });
  });

  describe('Combined Operators', () => {
    test('In-pipeline map and filter', async () => {
      const pipeline = [
        function* () {
          yield 1;
          yield 2;
          yield 3;
          yield 4;
        },
        streamOps.map(x => x * 2),
        streamOps.filter(x => x > 5)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual([6, 8]);
    });

    test('Chaining map and filter', async () => {
      const stream = streamOps(function* () {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
      })
        .map(x => x * 2)
        .filter(x => x > 5);

      const results = [];
      for await (const item of stream) {
        results.push(item);
      }

      expect(results).toEqual([6, 8]);
    });

    test('Complex pipeline with mixed operators and custom functions', async () => {
      const pipeline = [
        function* () {
          yield 1;
          yield 2;
          yield 3;
          yield 4;
          yield 5;
        },
        streamOps.map(x => x * 2),
        function (x) { return x + 1; },
        streamOps.filter(x => x % 2 === 1),
        streamOps.map(x => x * 10)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual([30, 50, 70, 90, 110]);
    });

    test('Complex chaining with mixed operators', async () => {
      const stream = streamOps(function* () {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
        yield 5;
      })
        .map(x => x * 2)
        .filter(x => x > 5)
        .map(x => x * 10);

      const results = [];
      for await (const item of stream) {
        results.push(item);
      }

      expect(results).toEqual([60, 80, 100]);
    });
  });

  describe('Error Handling', () => {
    test('Error in pipeline map operator', async () => {
      const pipeline = [
        function* () {
          yield 1;
          yield 2;
          yield 3;
        },
        streamOps.map(x => {
          if (x === 2) throw new Error('Test error');
          return x * 2;
        })
      ];

      await expect(async () => {
        for await (const item of streamOps(pipeline)) {
          // consume the stream
        }
      }).rejects.toThrow('Test error');
    });

    test('Error in chained map operator', async () => {
      const stream = streamOps(function* () {
        yield 1;
        yield 2;
        yield 3;
      }).map(x => {
        if (x === 2) throw new Error('Test error');
        return x * 2;
      });

      await expect(async () => {
        for await (const item of stream) {
          // consume the stream
        }
      }).rejects.toThrow('Test error');
    });
  });

  describe('Async Operations', () => {
    test('Async map in pipeline', async () => {
      const pipeline = [
        function* () {
          yield 1;
          yield 2;
          yield 3;
        },
        streamOps.map(async x => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return x * 2;
        })
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual([2, 4, 6]);
    });

    test('Async map in chain', async () => {
      const stream = streamOps(function* () {
        yield 1;
        yield 2;
        yield 3;
      }).map(async x => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return x * 2;
      });

      const results = [];
      for await (const item of stream) {
        results.push(item);
      }

      expect(results).toEqual([2, 4, 6]);
    });
  });

  test('In-pipeline reduce - sum', async () => {
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
        yield 5;
      },
      streamOps.reduce((acc, x) => acc + x, 0)
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 3, 6, 10, 15]);
  });

  test('Chaining reduce - sum', async () => {
    const stream = streamOps(function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }).reduce((acc, x) => acc + x, 0);

    const results = [];
    for await (const item of stream) {
      results.push(item);
    }

    expect(results).toEqual([1, 3, 6, 10, 15]);
  });

  test('In-pipeline reduce - product', async () => {
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
        yield 5;
      },
      streamOps.reduce((acc, x) => acc * x, 1)
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 2, 6, 24, 120]);
  });

  test('Chaining reduce - product', async () => {
    const stream = streamOps(function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }).reduce((acc, x) => acc * x, 1);

    const results = [];
    for await (const item of stream) {
      results.push(item);
    }

    expect(results).toEqual([1, 2, 6, 24, 120]);
  });

  test('Reduce with map - average', async () => {
    const pipeline = [
      function* () {
        yield 10;
        yield 20;
        yield 30;
        yield 40;
        yield 50;
      },
      streamOps.reduce((acc, x) => ({ sum: acc.sum + x, count: acc.count + 1 }), { sum: 0, count: 0 }),
      streamOps.map(({ sum, count }) => sum / count)
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([10, 15, 20, 25, 30]);
  });

  test('Reduce with custom accumulator object', async () => {
    const pipeline = [
      function* () {
        yield { name: 'Alice', age: 30 };
        yield { name: 'Bob', age: 25 };
        yield { name: 'Charlie', age: 35 };
      },
      streamOps.reduce((acc, person) => {
        return {
          totalAge: acc.totalAge + person.age,
          count: acc.count + 1,
          names: [...acc.names, person.name]
        };
      }, { totalAge: 0, count: 0, names: [] })
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      { totalAge: 30, count: 1, names: ['Alice'] },
      { totalAge: 55, count: 2, names: ['Alice', 'Bob'] },
      { totalAge: 90, count: 3, names: ['Alice', 'Bob', 'Charlie'] }
    ]);
  });
});