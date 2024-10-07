const createStreamOps = require('../src/createStreamOps');

describe('Accrue Operator', () => {
  let streamOps;

  beforeEach(() => {
    streamOps = createStreamOps();
  });

  test('Basic accumulation', async () => {
    const pipeline = [
      function* () {
        yield 'apple';
        yield 'banana';
        yield 'cherry';
      },
      streamOps.accrue(),
      streamOps.map((x) => {
        return x.join(' ');
      })
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      'apple banana cherry'
    ]);
  });

  test('Sorting with accrue', async () => {
    const pipeline = [
      function* () {
        yield 5;
        yield 2;
        yield 8;
        yield 1;
        yield 9;
      },
      streamOps.accrue(),
      streamOps.map((numbers) => numbers.sort((a, b) => a - b)),
      streamOps.map((sortedNumbers) => sortedNumbers.join(', '))
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual(['1, 2, 5, 8, 9']);
  });

  test('Accruing as a last step', async () => {
    const pipeline = [
      function* () {
        yield 5;
        yield 2;
        yield 8;
        yield 1;
        yield 9;
      },
      streamOps.accrue()
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([5, 2, 8, 1, 9]);
  });

  test('Accruing nested arrays', async () => {
    const pipeline = [
      function* () {
        yield 999;
        yield [
          1,2,3
        ];
        yield [
          4,5,6
        ];
      },
      streamOps.accrue()
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([
      999, [1,2,3], [4,5,6]
    ]);
  });

  test('Multiple accrue operations on book data', async () => {
    const pipeline = [
      function* () {
        yield { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: 1925, pages: 180 };
        yield { title: 'To Kill a Mockingbird', author: 'Harper Lee', year: 1960, pages: 281 };
        yield { title: '1984', author: 'George Orwell', year: 1949, pages: 328 };
        yield { title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, pages: 432 };
      },
      streamOps.accrue(),
      streamOps.map((books) => ({
        books,
        totalBooks: books.length,
        averageYear: Math.round(books.reduce((sum, book) => sum + book.year, 0) / books.length),
      })),
      streamOps.map(({ books, totalBooks, averageYear }) => ({
        books: books.map(book => `${book.title} by ${book.author}`),
        totalBooks,
        averageYear,
      })),
      streamOps.accrue(),
      streamOps.map(([data]) => ({
        bookList: data.books.join('; '),
        summary: `Total books: ${data.totalBooks}, Average year: ${data.averageYear}`,
      })),
    ];

    const results = [];
    for await (const item of streamOps(pipeline)) {
      results.push(item);
    }

    expect(results).toEqual([{
      bookList: 'The Great Gatsby by F. Scott Fitzgerald; To Kill a Mockingbird by Harper Lee; 1984 by George Orwell; Pride and Prejudice by Jane Austen',
      summary: 'Total books: 4, Average year: 1912',
    }]);
  });
});