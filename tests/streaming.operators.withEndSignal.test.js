const createStreamOps = require('../src/createStreamOps');
const { END_SIGNAL } = require('../src/CONSTANTS');

describe('withEndSignal Operator', () => {
  let streamOps;

  beforeEach(() => {
    streamOps = createStreamOps();
  });

  test('marks generator function to receive end signal', async () => {
    const endSignalReceived = [];
    
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
      },
      streamOps.withEndSignal(function* (input) {
        if (input === END_SIGNAL) {
          endSignalReceived.push(true);
          return;
        }
        yield input * 2;
      })
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([2, 4]);
    expect(endSignalReceived).toEqual([true]);
  });

  test('works with regular functions', async () => {
    const endSignalReceived = [];
    
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
      },
      streamOps.withEndSignal(function(input) {
        if (input === END_SIGNAL) {
          endSignalReceived.push(true);
          return null;
        }
        return input * 2;
      })
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([2, 4]);
    expect(endSignalReceived).toEqual([true]);
  });

  test('maintains this context', async () => {
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
      },
      streamOps.withEndSignal(function* (input) {
        this.count = (this.count || 0) + 1;
        if (input === END_SIGNAL) {
          yield this.count;
          return;
        }
        yield input * this.count;
      })
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 4, 3]); // 1*1, 2*2, final count
  });

  test('can be used with other operators', async () => {
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
        yield 3;
      },
      streamOps.withEndSignal(function* (input) {
        if (input === END_SIGNAL) {
          yield 'end';
          return;
        }
        yield input * 2;
      }),
      streamOps.filter(x => x !== 'end'),
      streamOps.map(x => x + 1)
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([3, 5, 7]);
  });

  test('handles errors properly', async () => {
    const pipeline = [
      function* () {
        yield 1;
        yield 2;
      },
      streamOps.withEndSignal(function* (input) {
        if (input === END_SIGNAL) {
          return;
        }
        throw new Error('Test error');
      })
    ];

    await expect(async () => {
      for await (const item of streamOps(pipeline)) {
        // consume the stream
      }
    }).rejects.toThrow('Test error');
  });
}); 