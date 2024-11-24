const createStreamOps = require('../src/createStreamOps');

describe('Skip and Take Operators', () => {
  let streamOps;

  beforeEach(() => {
    streamOps = createStreamOps();
  });

  describe('skip operator', () => {
    test('skips specified number of items', async () => {
      const pipeline = [
        function* () {
          yield 'First';
          yield 'Second';
          yield 'Third';
          yield 'Fourth';
        },
        streamOps.skip(2)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual(['Third', 'Fourth']);
    });

    test('handles skip larger than input', async () => {
      const pipeline = [
        function* () {
          yield 'First';
          yield 'Second';
        },
        streamOps.skip(5)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual([]);
    });
  });

  describe('take operator', () => {
    test('takes specified number of items', async () => {
      const pipeline = [
        function* () {
          yield 'First';
          yield 'Second';
          yield 'Third';
          yield 'Fourth';
        },
        streamOps.take(2)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual(['First', 'Second']);
    });

    test('handles take larger than input', async () => {
      const pipeline = [
        function* () {
          yield 'First';
          yield 'Second';
        },
        streamOps.take(5)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual(['First', 'Second']);
    });
  });

  describe('combined skip and take', () => {
    test('skip then take', async () => {
      const pipeline = [
        function* () {
          yield 'First';
          yield 'Second';
          yield 'Third';
          yield 'Fourth';
        },
        streamOps.skip(1),
        streamOps.take(2)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual(['Second', 'Third']);
    });

    test('take then skip', async () => {
      const pipeline = [
        function* () {
          yield 'First';
          yield 'Second';
          yield 'Third';
          yield 'Fourth';
        },
        streamOps.take(3),
        streamOps.skip(1)
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual(['Second', 'Third']);
    });

    test('skip then take with debug', async () => {
      const pipeline = [
        function* () {
          yield 'First';
          yield 'Second';
          yield 'Third';
          yield 'Fourth';
        },
        streamOps.tap(x => console.log('Before skip:', x)),
        streamOps.skip(1),
        streamOps.tap(x => console.log('After skip:', x)),
        streamOps.take(2),
        streamOps.tap(x => console.log('After take:', x))
      ];

      const results = [];
      for await (const item of streamOps(pipeline)) {
        results.push(item);
      }

      expect(results).toEqual(['Second', 'Third']);
    });
  });
}); 