module.exports = {

  map: function(fn) {
    return function* (input) {
      yield fn.call(this, input);
    };
  },

  filter: function(predicate) {
    return function* (input) {
      if (predicate(input)) yield input;
    };
  },

  reduce: function(reducer, initialValue) {
    return function* (input) {
      if (this.accumulator === undefined) {
        this.accumulator = initialValue;
      }
      this.accumulator = reducer(this.accumulator, input);
      yield this.accumulator;
    };
  },

  flatMap: function(fn) {
    return function* (input) {
      yield* fn.call(this, input);
    };
  },

  take: function(n) {
    return function* (input) {
      if (this.count === undefined) this.count = 0;
      if (this.count < n) {
        this.count++;
        yield input;
      }
    };
  },

  skip: function(n) {
    return function* (input) {
      if (this.count === undefined) this.count = 0;
      if (this.count >= n) {
        yield input;
      }
      this.count++;
    };
  },

  batch: function(size) {
    return function* (input) {
      this.buffer = this.buffer || [];
      this.buffer.push(input);
      if (this.buffer.length === size) {
        yield this.buffer;
        this.buffer = [];
      }
    };
  },

  debounce: function(ms) {
    return function* (input) {
      const now = Date.now();
      if (!this.lastYield || (now - this.lastYield) >= ms) {
        this.lastYield = now;
        yield input;
      }
    };
  },

  throttle: function(ms) {
    return function* (input) {
      const now = Date.now();
      if (!this.lastYield || (now - this.lastYield) >= ms) {
        this.lastYield = now;
        yield input;
      }
    };
  },

  distinct: function(equalityFn = (a, b) => a === b) {
    return function* (input) {
      this.seen = this.seen || [];
      if (!this.seen.some(seenItem => equalityFn.call(this, seenItem, input))) {
        this.seen.push(input);
        yield input;
      }
    };
  },

  catchError: function(handler) {
    return function* (input) {
      try {
        yield input;
      } catch (error) {
        handler(error);
      }
    };
  },

  tap: function(fn) {
    return function* (input) {
      fn.call(this, input);
      yield input;
    };
  },

  timeout: function(ms) {
    return function* (input) {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
      });
      yield Promise.race([Promise.resolve(input), timeoutPromise]);
    };
  }
};