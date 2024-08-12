const streaming = require('../index.js')({
  timeout: 30000,
  bufferSize: 1000,
  logLevel: 'info'
});

describe('streaming abstraction', () => {

  test('Multiple damming approach with alternating generators and functions', async () => {
    const pipeline = [
      // Generator: Produce initial stream of numbers
      function* numberStream() {
        for (let i = 1; i <= 10; i++) {
          yield i;
        }
      },
      
      // Function: First dam - collect and double all numbers
      function doubleNumbers(numbers) {
        return numbers.map(n => n * 2);
      },
      
      // Generator: Stream the doubled numbers one by one
      function* streamDoubled(num) {
        yield num;
      },
      
      // Function: Second dam - collect and sum all numbers
      function sumNumbers(numbers) {
        return [numbers.reduce((sum, n) => sum + n, 0)];
      },
      
      // Generator: Final stream - yield the sum multiple times
      function* repeatSum(sum) {
        // for (const sum of sums) {
          yield `The sum is: ${sum}`;
          yield `Double the sum is: ${sum * 2}`;
        // }
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    // Assertions
    expect(results).toEqual([
      'The sum is: 110',
      'Double the sum is: 220'
    ]);
    
  });
});