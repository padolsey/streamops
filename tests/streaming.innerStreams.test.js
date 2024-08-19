const streaming = require('../src/createStreamOps.js')({
  timeout: 30000,
  bufferSize: 1000,
  logLevel: 'info'
});

describe('Inner Streams Basics', () => {

  test('Simple streaming test', async () => {
    const log = [];
    const pipeline = [
      function*() {
        log.push('Step 1: Yielding 1');
        yield 1;
        log.push('Step 1: Yielding 2');
        yield 2;
        log.push('Step 1: Yielding 3');
        yield 3;
      },
      function*(num) {
        log.push(`Step 2: Received ${num}`);
        yield num * 2;
      },
      function*(num) {
        log.push(`Step 3: Received ${num}`);
        yield num + 1;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
      log.push(`Main: Received ${item}`);
    }

    console.log(log);
    console.log(results);

    expect(log).toEqual([
      'Step 1: Yielding 1',
      'Step 2: Received 1',
      'Step 3: Received 2',
      'Main: Received 3',
      'Step 1: Yielding 2',
      'Step 2: Received 2',
      'Step 3: Received 4',
      'Main: Received 5',
      'Step 1: Yielding 3',
      'Step 2: Received 3',
      'Step 3: Received 6',
      'Main: Received 7'
    ]);

    expect(results).toEqual([3, 5, 7]);
  });

  test('it works', async () => {
    const log = [];
    const stream = streaming([
      function*() {
        log.push('yielding 1');
        yield 1;
        log.push('yielding 2');
        yield 2;
        log.push('yielding 3');
        yield 3;
      },
      function*(n) {
        log.push('received ' + n);
        yield n;
      }
    ]);
    const results = [];
    for await (const x of stream) {}

    expect(log).toEqual([
      "yielding 1",
      "received 1",
      "yielding 2",
      "received 2",
      "yielding 3",
      "received 3"
    ]);
  });

  test('x', async() => {

    let nextGreeting = ['bonjour', 'hola', 'nihao', 'heya'];

    const stream = streaming([
      streaming([
        function*() {
          yield 'bob';
          yield 'sam';
        },
        function*(name) {
          yield 'hello ' + name;
          yield nextGreeting.shift() + ' ' + name;
        },
        function*(greeting) {
          yield greeting;
          yield greeting.toUpperCase();
        }
      ]),
      function*(msg) {
        yield 'Message: ' + msg;
      }
    ]);

    const results = [];
    for await (const x of stream) {
      results.push(x);
    }

    expect(results).toEqual([
      'Message: hello bob',
      'Message: HELLO BOB',
      'Message: bonjour bob',
      'Message: BONJOUR BOB',
      'Message: hello sam',
      'Message: HELLO SAM',
      'Message: hola sam',
      'Message: HOLA SAM'
    ]);

  });

  test('Nested streaming pipelines (agnostic approach)', async () => {
    const results = [];
    for await (const item of streaming([
      function*() {
        yield 'hello';
        yield 'hi';
      },
      streaming([
        function*(x) {
          yield 'HELLO';
          yield 'HI';
        }
      ])
    ])) {
      results.push(item);
    }
    expect(results).toEqual(['HELLO', 'HI']);
  });

  test('Inner stream is absorbed as it yields', async () => {
    let flag = false;
    const results = [];
    let next;
    const stream = streaming([
      streaming([
        function*() {
          yield 1;
          yield 2;
          yield 3;
        },
      ]),
      function*(num) {
        yield num + 1;
      }
    ]);
    for await (const item of stream) {
      results.push(item);
    }
    expect(results).toEqual([2, 3, 4]);
  });

  return;

  test('Nested streams and inter-step interactions', async () => {
    let flag = false;
    const results = [];
    
    const pipeline = [
      streaming([
        function*() {
          yield 1;
          if (flag) {
            yield 'Flag was set';
          }
          yield 2;
          yield 3;
        }
      ]),
      function*(num) {
        if (num === 1) {
          flag = true;
        }
        yield num;
        if (num === 2) {
          yield 'Extra item after 2';
        }
      }
    ];

    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([1, 'Flag was set', 2, 'Extra item after 2', 3]);
  });

});