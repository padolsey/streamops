const streaming = require('../src/createStreamOps.js')({
  timeout: 30000,
  bufferSize: 1000,
  logLevel: 'info'
});

describe('streaming abstraction : basic data flows', () => {

  // test('Returns latest', async () => {
  //   const res = await (streaming([
  //     9,
  //     10,
  //     11
  //   ]).next());
  //   expect(res.value).toEqual(11);
  // });

  // test('Happens in order', async () => {

  //   let happened = []

  //   const res = await (streaming([
  //     () => happened.push(1),
  //     () => happened.push(2),
  //     () => happened.push(3),
  //   ]).next());
  //   expect(happened).toEqual([1, 2, 3]);
  // });

  // test('More Data flowing', async () => {
  //   const results = [];
  //   for await (const x of streaming([
  //     [1, 2, 3],
  //     (number) => {
  //       return number;
  //     }
  //   ])) {
  //     results.push(x);
  //   }
  //   expect(results).toEqual([1,2,3]);
  // });

  test('Topic and BadThings pipeline without race conditions', async () => {
    const pipeline = [
      function* generateTopics() {
        yield 'Quantum Mechanics';
        yield 'Evolutionary Biology';
      },
      async function* (topic) {
        const badThings = [
          `Bad thing 1 about ${topic}`,
          `Bad thing 2 about ${topic}`
        ];
        
        yield { topic, badThings };
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      {
        topic: 'Quantum Mechanics',
        badThings: ['Bad thing 1 about Quantum Mechanics', 'Bad thing 2 about Quantum Mechanics']
      },
      {
        topic: 'Evolutionary Biology',
        badThings: ['Bad thing 1 about Evolutionary Biology', 'Bad thing 2 about Evolutionary Biology']
      }
    ]);
  });

});