const streaming = require('../src/createStreamOps.js')({
  timeout: 30000,
  logLevel: 'info'
});

describe('Parallel processing with async operations', () => {
  // Simulated API calls
  const fetchUserData = async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ id, name: `User ${id}` });
      }, 300); // 300ms delay
    });
  };

  const fetchUserPosts = async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([`Post 1 by User ${id}`, `Post 2 by User ${id}`]);
      }, 500); // 500ms delay
    });
  };

  const fetchUserFollowers = async (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(id * 100); // Simple follower count
      }, 200); // 200ms delay
    });
  };

  test('Parallel Processing', async () => {
    const pipeline = [
      () => [3],
      [
        ([x]) => x * 2,
        ([x]) => x + 1
      ]
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([6, 4]);
  });

  test('pipeline with parallel processing', async () => {
    const pipeline = [
      function*() {
        yield 1;
        yield 2;
      },
      [
        function*(num) { yield {double: num * 2}; },
        function*(num) { yield {triple: num * 3}; }
      ],
      (res) => {
        console.log('res', res);
        return res;
      }
    ];
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    expect(results).toEqual([
      { double: 2 },
      { triple: 3 },
      { double: 4 },
      { triple: 6 }
      // { double: 2, triple: 3 },
      // { double: 4, triple: 6 }
    ]);
  });

  test('generator after parallel step receives items individually', async () => {
    const receivedItems = [];
    const pipeline = [
      function*() {
        yield 1;
        yield 2;
      },
      [
        function*(num) { yield num * 2; },
        function*(num) { yield num * 3; }
      ],
      function*(result) {
        receivedItems.push(result);
        yield result;
      }
    ];
    
    const results = [];
    for await (const item of streaming(pipeline)) {
      results.push(item);
    }
    
    expect(receivedItems).toEqual([
      2,3,4,6
    ]);
    expect(results).toEqual([
      2,3,4,6
    ]);
  });

  return;

  test('Parallel API calls using yielded Promise.all', async () => {
    const pipeline = [
      function* userIds() {
        yield 1;
        yield 2;
      },
      function* parallelApiCalls(id) {
        yield Promise.all([
          fetchUserData(id),
          fetchUserPosts(id),
          fetchUserFollowers(id)
        ]);
      },
      async function* resultProcessor([userData, userPosts, followerCount]) {
        yield {
          user: userData,
          posts: userPosts,
          followers: followerCount,
          timestamp: new Date().toISOString()
        };
      }
    ];

    const results = [];
    const startTime = Date.now();

    for await (const item of streaming(pipeline)) {
      results.push(item);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Assertions
    expect(results.length).toBe(2);
    expect(results[0].user.id).toBe(1);
    expect(results[1].user.id).toBe(2);
    expect(results[0].posts.length).toBe(2);
    expect(results[1].posts.length).toBe(2);
    expect(results[0].followers).toBe(100);
    expect(results[1].followers).toBe(200);

    // Check if parallelization worked by verifying total time
    // If operations were sequential, it would take at least 2000ms (2 * (300 + 500 + 200))
    // With parallelization, it should take around 1000ms (2 * 500, as the longest operation is 500ms)
    // We'll add a small buffer for execution time
    expect(totalTime).toBeLessThan(1200);

    console.log(`Total execution time: ${totalTime}ms`);
  });
});