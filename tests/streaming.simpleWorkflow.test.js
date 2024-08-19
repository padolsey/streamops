const stream = require('../src/simple.js');

describe('"Simple" Interface Workflows', () => {

  test('Basic - just pass a pipeline to stream', async () => {
    
    expect(
      (await
        stream([
          function*() {
            yield 88;
          }
        ]).next()
      ).value
    ).toEqual(88);

  });

  test('Complex record-updating stream with dependency (i.e. operator) injection', async () => {

    const s = stream(
      ({reduce, map, batch, filter}) => [
        [
          {name: 'sam'}, // new record
          {age: 25},
          {location: 'london'},
          {age: 35}, // update
          {name: 'jolene', location: 'liverpool'}, // new record
          {name: 'sam', age: 45}, // new age for sam lol
          {name: 'anna', age: 50},
          {name: 'ben', age: 30}
        ],
        reduce((acc, obj) => {
          // Have we collected OR are we now collecting 'name'?
          // If not, just return acc.
          if (!obj.name && !acc.activeName) return {...acc};
          // But if so, we can create a new name record
          return {
            ...acc,
            activeName: obj.name || acc.activeName,
            [obj.name || acc.activeName]: {...acc[obj.name || acc.activeName], ...obj}
          };
        }, {activeName: '_undefined_'}),
        map((x) => {
          x = {...x};
          delete x.activeName;
          return x;
        }),
        filter(() => true),
        batch(1)
      ]
    );

    const results = [];
    for await (const r of s) {
      results.push(r);
    }

    expect(results.slice(-1)[0]).toEqual([
      {
        'sam': {
          name: 'sam',
          age: 45,
          location: 'london'
        },
        'jolene': {
          name: 'jolene',
          location: 'liverpool'
        },
        'anna': {
          name: 'anna',
          age: 50
        },
        'ben': {
          name: 'ben',
          age: 30
        }
      }
    ]);

  });

});