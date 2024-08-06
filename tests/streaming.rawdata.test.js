const streaming = require('../streaming.js')({
  timeout: 30000,
  bufferSize: 1000,
  logLevel: 'info'
});

describe('streaming abstraction : basic data flows', () => {

  test('Returns latest', async () => {
    const res = await (streaming([
      9,
      10,
      11
    ]).next());
    expect(res.value).toEqual(11);
  });

  test('Happens in order', async () => {

    let happened = []

    const res = await (streaming([
      () => happened.push(1),
      () => happened.push(2),
      () => happened.push(3),
    ]).next());
    expect(happened).toEqual([1, 2, 3]);
  });

  test('More Data flowing', async () => {
    const res = await (streaming([
      [1, 2, 3],
      ([a,b,c]) => {
        return {a,b,c}
      }
    ]).next());
    expect(res.value).toEqual({
      a: 1,
      b: 2,
      c: 3
    });
  });

  test('More Advanced Data flowing', async () => {
    const res = await (streaming([
      () => [1, 2, 3],
      [
        (nums) => nums.join(','),
        (nums) => nums.join('%')
      ],
      ([x, y]) => {
        return {x, y}
      }
    ]).next());
    expect(res.value).toEqual({
      "x": "1,2,3",
      "y": "1%2%3"
    });
  });

});