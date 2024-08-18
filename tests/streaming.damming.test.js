const streaming = require('../index.js')({
  timeout: 30000,
  bufferSize: 1000,
  logLevel: 'info'
});
function accumulator(count) {
  return function* (item) {
    this.buffer = this.buffer || [];
    this.buffer.push(item);
    
    if (this.buffer.length === count) {
      yield this.buffer;
      this.buffer = [];
    }
  };
}

// Skipping these while we're figuring out damming
// Likely best to use operator methods
describe('streaming abstraction - damming', () => {

  xtest('accumulator', async () => {
    const pipeline = [
      function* () {
        yield 'apple';
        yield 'banana';
        yield 'cherry';
        yield 'date';
        yield 'elderberry';
      },
      accumulator(3),
      function* (group) {
        yield `Group: ${group.join(', ')}`;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      'The sum is: 110',
      'Double the sum is: 220'
    ]);
  });

  xtest('Multiple damming approach with alternating generators and functions', async () => {
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
        console.log('NUMBERS>>>>>', numbers)
        return [numbers.reduce((sum, n) => sum + n, 0)];
      },
      
      // Generator: Final stream - yield the sum multiple times
      function* repeatSum(sum) {
        yield `The sum is: ${sum}`;
        yield `Double the sum is: ${sum * 2}`;
      }
    ];

    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      'The sum is: 110',
      'Double the sum is: 220'
    ]);
    
  });
});