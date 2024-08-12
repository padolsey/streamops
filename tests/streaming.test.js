const streaming = require('../index.js')({
  timeout: 30000,
  bufferSize: 1000,
  logLevel: 'info'
});

describe('streaming abstraction', () => {
  test('basic pipeline with single generator', async () => {
    const pipeline = [
      function*() {
        yield 1;
        yield 2;
        yield 3;
      }
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    // Ensure the basic yielding works
    expect(results).toEqual([1, 2, 3]);
  });

  test('pipeline with transformation', async () => {
    const pipeline = [
      function*() {
        yield 1;
        yield 2;
        yield 3;
      },
      function*(num) {
        yield num * 2;
      }
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    // Check if transformation is applied correctly
    expect(results).toEqual([2, 4, 6]);
  });

  test('pipeline with aggregation', async () => {
    const pipeline = [
      function*() {
        yield 1;
        yield 2;
        yield 3;
      },
      (numbers) => numbers.reduce((sum, num) => sum + num, 0)
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    // Check if aggregation works correctly
    expect(results).toEqual([6]);
  });

  test('pipeline with async operations', async () => {
    const pipeline = [
      function*() {
        yield 'hello';
        yield 'world';
      },
      async function*(word) {
        await new Promise(resolve => setTimeout(resolve, 10));
        yield word.toUpperCase();
      }
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    // Ensure async operations are handled properly
    expect(results).toEqual(['HELLO', 'WORLD']);
  });

  test('pipeline with filtering', async () => {
    const pipeline = [
      function*() {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
      },
      function*(num) {
        if (num % 2 === 0) {
          yield num;
        }
      }
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    // Verify that filtering works as expected
    expect(results).toEqual([2, 4]);
  });

  test('empty pipeline', async () => {
    const pipeline = [];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    // Check handling of empty pipeline
    expect(results).toEqual([]);
  });

  test('pipeline with error handling', async () => {
    const pipeline = [
      function*() {
        yield 1;
        throw new Error('Test error');
      }
    ];
    // Ensure errors are propagated correctly
    await expect(async () => {
      for await (const item of streaming(pipeline)) {
        // consume the stream
      }
    }).rejects.toThrow('Test error');
  });

  test('error handling in generator function', async () => {
    const pipeline = [
      function*() {
        yield 1;
        throw new Error('Test error');
      }
    ];
    await expect(async () => {
      for await (const item of streaming(pipeline)) {
        // consume the stream
      }
    }).rejects.toThrow('Test error');
  });

  test('empty generator in pipeline', async () => {
    const pipeline = [
      function*() {
        // yields nothing
      },
      (x) => x
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([]);
  });

  test('mixed sync and async operations', async () => {
    const pipeline = [
      function*() { yield 1; yield 2; },
      async function*(x) { await new Promise(resolve => setTimeout(resolve, 10)); yield x * 2; },
      function*(x) { yield x + 1; }
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([3, 5]);
  });

  test('Sequential Processing', async () => {
    const pipeline = [
      () => 5,
      (x) => x * 2,
      (x) => `Result: ${x}`
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual(['Result: 10']);
  });

  test('Multiple Value Handling', async () => {
    const pipeline = [
      function*() { yield 1; yield 2; },
      function*(x) { yield x * 2; }
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([2, 4]);
  });

  test('State Management', async () => {
    const pipeline = [
      () => ({count: 1}),
      ({count}) => ({count: count + 1}),
      ({count}) => `Final count: ${count}`
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual(['Final count: 2']);
  });

  test('Async Operations', async () => {
    const fetchData = async () => 'data';
    const processData = async (data) => data.toUpperCase();
    const pipeline = [
      async () => await fetchData(),
      async (data) => await processData(data)
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual(['DATA']);
  });

  test('Reducer Functions', async () => {
    const pipeline = [
      function*() { yield 1; yield 2; yield 3; },
      (numbers) => numbers.reduce((sum, n) => sum + n, 0)
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([6]);
  });

  test('Simple text streaming', async () => {
    const pipeline = [
      function* textGenerator() {
        yield 'Hello';
        yield ' ';
        yield 'World';
        yield '!';
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['Hello', ' ', 'World', '!']);
  });

  test('Objects can be passed down', async () => {
    const pipeline = [
      async function*() {
        yield {
          message: 'hello'
        };
      },
      [
        async function*({message}) {
          yield {
            message: message + ' there'
          }
        },
        async function*({message}) {
          yield {
            message: message + ' my friend'
          }
        }
      ],
      function*(messages) {
        for (const {message} of messages) {
          yield {
            message,
            name: 'Michael'
          }
        }
      }
    ];

    // const results = await streaming(pipeline);

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      { "message": "hello there", "name": "Michael" },
      { "message": "hello my friend", "name": "Michael" }
    ]);
  });

  test('Stateful context retained throughout pipeline', async () => {
    const pipeline = [
      function* n() {
        yield 1;
        yield 2;
        yield 3;
      },
      function* s(input) {
        this.something = 99;
        yield String(input);
      },
      function all(all) {
        return all.map(_ => _ + this.something);
      }
    ];

    // const results = await streaming(pipeline);

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['199', '299', '399']);
  });

  test('Accumulating results across steps', async () => {

    const generatedTopics = {};

    const pipeline = [
      function* topicGenerator() {
        yield { topic: 'Quantum Mechanics' };
        yield { topic: 'Evolutionary Biology' };
      },
      [
        function* badThingsGenerator({ topic }) {
          yield { topic, bad_thing: `Bad thing 1 about ${topic}` };
          yield { topic, bad_thing: `Bad thing 2 about ${topic}` };
        },
        function* goodThingsGenerator({ topic }) {
          yield { topic, good_thing: `Good thing 1 about ${topic}` };
          yield { topic, good_thing: `Good thing 2 about ${topic}` };
        }
      ],
      function resultAggregator(things) {
        
        for (const item of things.flat()) {
          const topic = item.topic;

          if (!generatedTopics[topic]) {
            generatedTopics[topic] = {
              topic: topic,
              bad_things: [],
              good_things: []
            };
          }

          if (item.bad_thing) {
            generatedTopics[topic].bad_things.push(item.bad_thing);
          }

          if (item.good_thing) {
            generatedTopics[topic].good_things.push(item.good_thing);
          }
        }

        return generatedTopics;

      }
    ];

    expect((await streaming(pipeline).next()).value).toEqual({
      "Evolutionary Biology": {
        "bad_things": [
          "Bad thing 1 about Evolutionary Biology",
          "Bad thing 2 about Evolutionary Biology"
        ],
        "good_things": [
          "Good thing 1 about Evolutionary Biology",
          "Good thing 2 about Evolutionary Biology"
        ],
        "topic": "Evolutionary Biology"
      },
      "Quantum Mechanics": {
        "bad_things": [
          "Bad thing 1 about Quantum Mechanics",
          "Bad thing 2 about Quantum Mechanics"
        ],
        "good_things": [
          "Good thing 1 about Quantum Mechanics",
          "Good thing 2 about Quantum Mechanics"
        ],
        "topic": "Quantum Mechanics"
      }
    });
  });

  test('HTTP-like stream transformation', async () => {
    // Simulate an HTTP-like stream
    const mockHttpStream = async function*() {
      yield '{"id": 1, "name":';
      yield ' "John Doe", "age": ';
      yield '30, "city": "New York"}';
      yield '{"id": 2, "name":';
      yield ' "Jane Smith", "age":';
      yield ' 28, "city": "London"}';
    };

    // JSON parser to accumulate and parse JSON chunks
    const jsonParser = async function*(chunk) {
      this.buffer = (this.buffer || '') + chunk;
      const objects = this.buffer.split('}');
      
      for (let i = 0; i < objects.length - 1; i++) {
        const jsonStr = objects[i] + '}';
        try {
          const parsed = JSON.parse(jsonStr);
          yield parsed;
        } catch (e) {
          // If parsing fails, it might be an incomplete object
          continue;
        }
      }
      
      this.buffer = objects[objects.length - 1];
    };

    // Transform parsed objects
    const transformer = function*(obj) {
      yield {
        ...obj,
        fullName: `${obj.name} from ${obj.city}`,
        isAdult: obj.age >= 18
      };
    };

    const pipeline = [
      mockHttpStream,
      jsonParser,
      transformer
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      {
        id: 1,
        name: "John Doe",
        age: 30,
        city: "New York",
        fullName: "John Doe from New York",
        isAdult: true
      },
      {
        id: 2,
        name: "Jane Smith",
        age: 28,
        city: "London",
        fullName: "Jane Smith from London",
        isAdult: true
      }
    ]);
  });

});