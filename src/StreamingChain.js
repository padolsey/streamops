const operators = require('./operators');

class StreamingChain {
  constructor(initialPipeline, _createStreamOps) {
    this.createStreamOps = _createStreamOps;
    this.pipeline = Array.isArray(initialPipeline) ? initialPipeline : [initialPipeline];
  }

  map(fn) {
    this.pipeline.push(operators.map(fn));
    return this;
  }

  filter(predicate) {
    this.pipeline.push(operators.filter(predicate));
    return this;
  }

  reduce(reducer, initialValue) {
    this.pipeline.push(operators.reduce(reducer, initialValue));
    return this;
  }

  flatMap(fn) {
    this.pipeline.push(operators.flatMap(fn));
    return this;
  }

  take(n) {
    this.pipeline.push(operators.take(n));
    return this;
  }

  skip(n) {
    this.pipeline.push(operators.skip(n));
    return this;
  }

  batch(size) {
    this.pipeline.push(operators.batch(size));
    return this;
  }

  debounce(ms) {
    this.pipeline.push(operators.debounce(ms));
    return this;
  }

  throttle(ms) {
    this.pipeline.push(operators.throttle(ms));
    return this;
  }

  mergeAggregate(ms) {
    this.pipeline.push(operators.mergeAggregate(ms));
    return this;
  }

  distinct(equalityFn) {
    this.pipeline.push(operators.distinct(equalityFn));
    return this;
  }

  catchError(handler) {
    this.pipeline.push(operators.catchError(handler));
    return this;
  }

  tap(fn) {
    this.pipeline.push(operators.tap(fn));
    return this;
  }

  timeout(ms) {
    this.pipeline.push(operators.timeout(ms));
    return this;
  }

  [Symbol.asyncIterator]() {
    return this.createStreamOps()(this.pipeline);
  }
}

module.exports = StreamingChain;