const streaming = require('../index.js')({
  timeout: 30000,
  bufferSize: 1000,
  logLevel: 'info'
});

describe('Parallel & Nesting', () => {

  test('nested parallel processing with damming fns', async () => {
    const pipeline = [
      function*() { yield 1; yield 2; },
      [
        [
          ([x]) => x * 2,
          ([x]) => x * 3
        ],
        ([x]) => x + 100
      ]
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([2, 3, 101, 4, 6, 102]);
  });

  test('nested parallel processing with generators', async () => {
    const pipeline = [
      function*() { yield 1; yield 2; },
      [
        [
          function*(x) { yield x * 2 },
          function*(x) { yield x * 3 }
        ],
        function*(x) { yield x + 100 }
      ]
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([2, 3, 101, 4, 6, 102]);
  });

  test('Parallel Processing', async () => {
    const pipeline = [
      () => [3],
      [
        ([x]) => x * 2,
        ([x]) => x + 1
      ]
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([6, 4]);
  });

  test('Double nested parallelism', async () => {
    const pipeline = [
      () => 2,
      [
        [([x]) => x * 2, ([x]) => x * 3],
        ([x]) => x + 1
      ]
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([4, 6, 3]);
  });

  test('Nesting a streaming pipeline', async () => {
    const res = await (streaming([
      streaming([
        function*() {
          yield 'hello';
        }
      ]),
      function*(x) {
        yield x + ' you';
      }
    ]).next());
    expect(res.value).toEqual('hello you');
  });

  test('Not sure what this is testing but it seems desirable', async () => {
    const stream = streaming([
      ['apple'],
      function*(thing) {
        yield thing === 'apple';
      }
    ]);
    expect((await stream.next()).value).toEqual(true);
  });

  // test('Nested streaming pipelines with sub-streeems', async () => {
  //   const results = [];
  //   for await (const item of streaming([
  //     function*() {
  //       yield 'hello';
  //       yield 'hi';
  //     },
  //     streaming([
  //       function*(greeting) {
  //         yield greeting.toUpperCase()
  //       }
  //     ])
  //   ])) {
  //     results.push(item);
  //   }

  //   expect(results).toEqual([
  //     'Result: 3',
  //     'Result: 30',
  //     'Result: 5',
  //     'Result: 50'
  //   ]);
  // });
  
});