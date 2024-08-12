const streaming = require('../index.js')({
  timeout: 30000,
  bufferSize: 1000,
  logLevel: 'info'
});

describe('Inner streeeeems', () => {

  test('Nested streaming pipelines (agnostic approach)', async () => {
    const results = [];
    for await (const item of streaming([
      function*() {
        yield 'hello';
        yield 'hi';
      },
      streaming([
        function*() {
          yield 'HELLO';
          yield 'HI';
        }
      ])
    ])) {
      results.push(item);
    }
    expect(results).toEqual(['HELLO', 'HI']);
  });


});