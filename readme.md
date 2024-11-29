# StreamOps

A lightweight streaming operations library for JS that provides a flexible pipeline-based approach to data processing. StreamOps leverages generators and async generators to create efficient data processing pipelines with built-in support for parallel processing, error handling, and state management.

## Installation

<pre>
npm install streamops
</pre>

## Key Features

- **Pipeline-based streaming operations:** Build complex data processing pipelines with ease
- **Async/sync generator support:** Seamlessly mix sync and async operations
- **Parallel processing:** Process data concurrently with parallel branches
- **State management:** Share state across pipeline steps
- **Configurable error handling:** Robust error handling with timeouts
- **Rich operator set:** Comprehensive set of built-in operators

## Getting Started

### Basic Pipeline

<pre>
const createStreamOps = require('streamops');
const stream = createStreamOps();

// Array-style pipeline
const pipeline = [
  function* () {
    yield 1;
    yield 2;
    yield 3;
  },
  stream.map(x => x * 2),
  stream.filter(x => x > 4)
];

// Process the stream
for await (const item of stream(pipeline)) {
  console.log(item); // Outputs: 4, 6
}
</pre>

### Chaining Style

<pre>
const result = stream(function* () {
  yield 1;
  yield 2;
  yield 3;
})
  .map(x => x * 2)
  .filter(x => x > 4);

for await (const item of result) {
  console.log(item); // Outputs: 4, 6
}
</pre>

### Real-World Example: Processing API Data

<pre>
const pipeline = [
  // Fetch and yield data
  async function* () {
    const response = await fetch('https://api.example.com/users');
    const users = await response.json();
    for (const user of users) {
      yield user;
    }
  },
  // Transform data
  stream.map(user => ({
    id: user.id,
    name: user.name,
    isActive: user.status === 'active'
  })),
  // Filter active users
  stream.filter(user => user.isActive),
  // Process in batches
  stream.batch(10)
];

for await (const userBatch of stream(pipeline)) {
  await processUserBatch(userBatch);
}
</pre>

## Configuration

<pre>
const stream = createStreamOps({
  timeout: 30000,        // Overall pipeline timeout
  logLevel: 'info',      // 'error' | 'warn' | 'info' | 'debug'
  yieldTimeout: 20000,   // Max time between yields
  downstreamTimeout: 30000  // Max time without downstream consumption
});
</pre>

### Timeout Behaviors

- `yieldTimeoutBehavior`: Controls timeout handling
  - `'warn'`: Log warning and continue (default)
  - `'yield-null'`: Yield null value and continue
  - `'cancel'`: Cancel pipeline
  - `'block'`: Stop yielding from timed-out step

## Error Handling

### Using catchError Operator

<pre>
const pipeline = [
  riskyOperation,
  stream.catchError(error => {
    console.error('Operation failed:', error);
    // Handle error appropriately
  }),
  nextStep
];
</pre>

### Timeout Protection

<pre>
const pipeline = [
  longRunningOperation,
  stream.timeout(5000),  // Fails if step takes > 5s
  stream.catchError(error => {
    if (error.name === 'TimeoutError') {
      // Handle timeout
    }
  })
];
</pre>

## Stream Control

### End of Stream Handling

<pre>
const { END_SIGNAL } = require('streamops');

const pipeline = [
  sourceStream,
  stream.withEndSignal(function* (input) {
    if (input === END_SIGNAL) {
      yield* cleanup();
      return;
    }
    yield processInput(input);
  })
];
</pre>

### Flow Control with Accrue

The `accrue` operator collects all items before continuing:

<pre>
const pipeline = [
  source,
  stream.accrue(),  // Collect all items
  stream.map(items => processItems(items))
];
</pre>

## Advanced Features

### Parallel Processing

<pre>
const pipeline = [
  source,
  [  // Parallel branches
    [  // Nested parallel
      stream.map(x => x * 2),
      stream.map(x => x + 1)
    ],
    stream.filter(x => x > 10)
  ]
];
</pre>

Results from parallel branches are merged in order.

### State Management

Maintain state via 'this' context:

<pre>
const pipeline = [
  source,
  function* (input) {
    this.count = (this.count || 0) + 1;
    yield `${this.count}: ${input}`;
  }
];
</pre>

## API Documentation

### Built-in Operators

#### Basic Operators

- `map(fn)`: Transform each item using the provided function
  <pre>
  stream.map(x => x * 2)
  </pre>

- `filter(predicate)`: Only allow items that match the predicate
  <pre>
  stream.filter(x => x > 5)
  </pre>

- `reduce(reducer, initialValue)`: Accumulate values, yielding intermediate results
  <pre>
  stream.reduce((sum, x) => sum + x, 0)
  </pre>

- `flatMap(fn)`: Map each item to multiple items
  <pre>
  stream.flatMap(x => [x, x * 2])
  </pre>

#### Control Operators

- `take(n)`: Limit stream to first n items
  <pre>
  stream.take(5)  // Only first 5 items
  </pre>

- `skip(n)`: Skip first n items
  <pre>
  stream.skip(2)  // Skip first 2 items
  </pre>

- `batch(size, options)`: Group items into arrays of specified size
  <pre>
  stream.batch(3, { yieldIncomplete: true })
  </pre>
  Options:
  - `yieldIncomplete`: Whether to yield incomplete batches (default: true)

- `distinct(equalityFn)`: Remove duplicates using optional equality function
  <pre>
  stream.distinct((a, b) => a.id === b.id)
  </pre>

#### Advanced Operators

- `mergeAggregate(options)`: Merge objects into arrays by key
  <pre>
  stream.mergeAggregate({ 
    removeDuplicates: true,
    alwaysArray: true 
  })
  </pre>

- `waitUntil(condition)`: Buffer items until condition is met
  <pre>
  // Wait for specific fields
  stream.waitUntil(['price', 'volume'])
  // Or custom condition
  stream.waitUntil(buffer => buffer.length >= 3)
  </pre>

- `bufferBetween(startToken, endToken, mapFn)`: Capture content between tokens
  <pre>
  stream.bufferBetween('<start>', '</end>', content => parse(content))
  </pre>

#### Error Handling

- `catchError(handler)`: Handle errors in the pipeline
  <pre>
  stream.catchError(err => console.error(err))
  </pre>

- `timeout(ms)`: Fail if processing takes too long
  <pre>
  stream.timeout(5000)  // 5 second timeout
  </pre>

#### Utility Operators

- `tap(fn)`: Execute side effects without modifying stream
  <pre>
  stream.tap(x => console.log('Saw:', x))
  </pre>

- `accrue()`: Collect all items before proceeding
  <pre>
  stream.accrue()
  </pre>

- `dam()`: Alias for accrue()

#### Stream Control Operators

- `withEndSignal(fn)`: Mark a function/generator to receive end signals
  <pre>
  stream.withEndSignal(function* (input) {
    if (input === END_SIGNAL) {
      // Handle end of stream
      yield* cleanup();
      return;
    }
    yield process(input);
  })
  </pre>

### Simple Interface

StreamOps also provides a simplified interface for creating pipelines:

<pre>
const { simple } = require('streamops');

// Create pipeline with injected operators
const stream = simple(
  ({map, filter}) => [
    [1, 2, 3, 4],
    map(x => x * 2),
    filter(x => x > 5)
  ]
);

for await (const item of stream) {
  console.log(item);  // Outputs: 6, 8
}
</pre>

The simple interface automatically injects operators and handles pipeline creation.

## Debugging

### Logging

Set logLevel in configuration:
<pre>
const stream = createStreamOps({
  logLevel: 'debug'  // See all pipeline operations
});
</pre>

Use tap operator for debugging:
<pre>
stream.tap(x => console.log('Value:', x))
</pre>

### Common Issues

1. Memory Leaks
   - Use batch operator for large streams
   - Consider accrue carefully

2. Timeouts
   - Adjust timeout configuration
   - Use appropriate yieldTimeoutBehavior

3. Backpressure
   - Monitor downstreamTimeout warnings
   - Use batch operator to control flow


## License

MIT