// test bufferBetween

const createStreamOps = require('../src/createStreamOps');

describe('BufferBetween Operator', () => {
  let streamOps;

  beforeEach(() => {
    streamOps = createStreamOps();
  });

  test('Basic functionality', async () => {
    const pipeline = [
      function* () {
        yield 'Hello world! How are you?';
      },
      streamOps.bufferBetween('world', 'you')
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['Hello ', 'world! How are you', '?']);
  });

  test('Multiple start-end pairs', async () => {
    const pipeline = [
      function* () {
        yield 'Start1 content1 End1 Start2 content2 End2';
      },
      streamOps.bufferBetween('Start', 'End')
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['Start1 content1 End', '1 ', 'Start2 content2 End', '2']);
  });

  test('No matching tokens', async () => {
    const pipeline = [
      function* () {
        yield 'Hello world! How are you?';
      },
      streamOps.bufferBetween('start', 'end')
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['Hello world! How are you?']);
  });

  test('Empty input', async () => {
    const pipeline = [
      function* () {
        yield '';
      },
      streamOps.bufferBetween('start', 'end')
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([]);
  });

  test('Start token at the end of a chunk', async () => {
    const pipeline = [
      function* () {
        yield 'Hello start';
        yield ' content end more';
      },
      streamOps.bufferBetween('start', 'end')
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['Hello ', 'start content end', ' more']);
  });

  test('End token at the beginning of a chunk', async () => {
    const pipeline = [
      function* () {
        yield 'Hello start content';
        yield 'end more';
      },
      streamOps.bufferBetween('start', 'end')
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['Hello ', 'start contentend', ' more']);
  });

  test('Simple nested start-end pairs', async () => {
    const pipeline = [
      function* () {
        yield 'start outer start inner end outer';
      },
      streamOps.bufferBetween('start', 'end')
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['start outer start inner end', ' outer']);
  });

  test('Multiple cycles of buffering', async () => {
    const pipeline = [
      function* () {
        yield 'Before start first middle end ';
        yield 'start second middle end After';
      },
      streamOps.bufferBetween('start', 'end')
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      'Before ',
      'start first middle end',
      ' ',
      'start second middle end',
      ' After'
    ]);
  });

  // Test it between singular character markers like ~ and then $:
  test('Single character markers', async () => {
    const pipeline = [
      function* () {
        yield 'ffffff~';
        yield 'ggg$kkk';
        yield ' ok ';
      },
      streamOps.bufferBetween('~', '$')
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['ffffff', '~ggg$', 'kkk', ' ok ']);
  });

  // Add these new tests at the end of the file:

  test('With mapping function', async () => {
    const pipeline = [
      function* () {
        yield 'Hello ~world~ How ~are you~?';
      },
      streamOps.bufferBetween('~', '~', content => content.toUpperCase())
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['Hello ', '~WORLD~', ' How ', '~ARE YOU~', '?']);
  });

  test('With mapping function and multiple chunks', async () => {
    const pipeline = [
      function* () {
        yield 'Hello ~wor';
        yield 'ld~ How ~are ';
        yield 'you~?';
      },
      streamOps.bufferBetween('~', '~', content => content.split('').reverse().join(''))
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['Hello ', '~dlrow~', ' How ', '~uoy era~', '?']);
  });

  test('With mapping function and single character tokens', async () => {
    const pipeline = [
      function* () {
        yield 'a$hello$b$world$c';
      },
      streamOps.bufferBetween('$', '$', content => content.length.toString())
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['a', '7', 'b', '7', 'c']);
  });

  test('Mutating inner content between XML tags', async () => {
    const pipeline = [
      function* () {
        yield '<xml>Hello world!</xml>';
      },
      streamOps.bufferBetween('<xml>', '</xml>', content => {
        console.log('>>>> content', content);
        return content.toUpperCase().replace(/<\/?xml>/gi, '');
      })
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['HELLO WORLD!']);
  });

  

});
