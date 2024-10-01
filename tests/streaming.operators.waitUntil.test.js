const createStreamOps = require('../src/createStreamOps');

describe('waitUntil Operator', () => {
  let streamOps;

  beforeEach(() => {
    streamOps = createStreamOps();
  });

  test('Waits until all specified fields are present', async () => {
    const pipeline = [
      function* () {
        yield { field1: 'value1' };
        yield { field2: 'value2' };
        yield { field3: 'value3' };
      },
      streamOps.waitUntil(['field1', 'field2', 'field3'])
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([[
      { field1: 'value1' },
      { field2: 'value2' },
      { field3: 'value3' }
    ]]);
  });

  test('Waits until specified key-value pairs are present', async () => {
    const pipeline = [
      function* () {
        yield { type: 'start', value: 10 };
        yield { type: 'middle', value: 20 };
        yield { type: 'end', value: 30 };
      },
      streamOps.waitUntil({ type: 'end' })
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([[
      { type: 'start', value: 10 },
      { type: 'middle', value: 20 },
      { type: 'end', value: 30 }
    ]]);
  });

  test('Uses custom function for complex conditions', async () => {
    const pipeline = [
      function* () {
        yield { count: 1 };
        yield { count: 2 };
        yield { count: 3, isLast: true };
      },
      streamOps.waitUntil(buffer => 
        buffer.length >= 3 && buffer.some(item => item.isLast)
      )
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([[
      { count: 1 },
      { count: 2 },
      { count: 3, isLast: true }
    ]]);
  });

  test('Handles multiple cycles of waiting and yielding', async () => {
    const pipeline = [
      function* () {
        yield { type: 'start', id: 1 };
        yield { type: 'middle', id: 1 };
        yield { type: 'end', id: 1 };
        yield { type: 'start', id: 2 };
        yield { type: 'middle', id: 2 };
        yield { type: 'end', id: 2 };
      },
      streamOps.waitUntil(buffer => 
        buffer.some(item => item.type === 'end')
      )
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      [
        { type: 'start', id: 1 },
        { type: 'middle', id: 1 },
        { type: 'end', id: 1 }
      ],
      [
        { type: 'start', id: 2 },
        { type: 'middle', id: 2 },
        { type: 'end', id: 2 }
      ]
    ]);
  });

  test('Waits for closing tags in XML-like structure', async () => {
    const pipeline = [
      function* () {
        yield { tag: 'open', name: 'root' };
        yield { tag: 'open', name: 'child' };
        yield { content: 'some data' };
        yield { tag: 'close', name: 'child' };
        yield { tag: 'close', name: 'root' };
      },
      streamOps.waitUntil(buffer => {
        const openTags = buffer.filter(item => item.tag === 'open');
        const closeTags = buffer.filter(item => item.tag === 'close');
        return openTags.length === closeTags.length && 
               openTags.every(open => 
                 closeTags.some(close => close.name === open.name)
               );
      })
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([[
      { tag: 'open', name: 'root' },
      { tag: 'open', name: 'child' },
      { content: 'some data' },
      { tag: 'close', name: 'child' },
      { tag: 'close', name: 'root' }
    ]]);
  });

  test('Throws error for invalid condition', async () => {
    expect(() => {
      streamOps.waitUntil('invalid condition');
    }).toThrow('Invalid condition type');
  });

});