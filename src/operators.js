class Dam {}
module.exports.Dam = Dam;
const operators = module.exports.operators = {

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
      if (this.takeCount === undefined) {
        this.takeCount = 0;
      }
      if (this.takeCount < n) {
        this.takeCount++;
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

  batch: function(size, {yieldIncomplete = true} = {}) {
    return function* (input) {
      if (!this.batchBuffer) {
        this.batchBuffer = [];
      }

      if (input !== undefined) {
        this.batchBuffer.push(input);

        if (this.batchBuffer.length >= size) {
          const batch = this.batchBuffer.slice(0, size);
          this.batchBuffer = this.batchBuffer.slice(size);
          yield batch;
        }
      } else if (yieldIncomplete && this.batchBuffer.length > 0) {
        // Yield remaining items when stream ends
        yield this.batchBuffer;
        this.batchBuffer = [];
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
  },


  mergeAggregate: function(options = {}) {
    const {
      removeDuplicates = true,
      alwaysArray = true
    } = options;
    return function* (input) {
      this.result = this.result || {};

      if (input !== undefined) {
        for (const [key, value] of Object.entries(input)) {
          if (!(key in this.result)) {
            this.result[key] = [];
          }
          if (Array.isArray(value)) {
            this.result[key].push(...value);
          } else {
            this.result[key].push(value);
          }
        }
      }

      let output = {};
      for (const [key, value] of Object.entries(this.result)) {
        let processedValue = value;
        if (removeDuplicates) {
          processedValue = value.filter((v, i, self) =>
            i === self.findIndex((t) => (
              t && v && typeof t === 'object' && typeof v === 'object'
                ? JSON.stringify(t) === JSON.stringify(v)
                : t === v
            ))
          );
        }
        output[key] = alwaysArray ? processedValue : (processedValue.length === 1 ? processedValue[0] : processedValue);
      }
      yield output;
    };
  },

  waitUntil: function(conditions) {
    if (typeof conditions !== 'function' && !Array.isArray(conditions) && (typeof conditions !== 'object' || conditions === null)) {
      throw new Error('Invalid condition type');
    }

    return function* (input) {
      this.buffer = this.buffer || [];
      this.buffer.push(input);

      const isReady = () => {
        if (typeof conditions === 'function') {
          return conditions(this.buffer);
        }

        if (Array.isArray(conditions)) {
          return conditions.every(field => this.buffer.some(item => field in item));
        }
  
        if (typeof conditions === 'object') {
          return Object.entries(conditions).every(([key, value]) => 
            this.buffer.some(item => item[key] === value)
          );
        }

        return false;
      };

      if (isReady()) {
        const result = this.buffer;
        this.buffer = [];
        yield result;
      }
    };
  },

  bufferBetween: function(startToken, endToken, mapFn = null) {
    return function* (input) {
      this.buffer = this.buffer || '';
      this.buffering = this.buffering || false;

      let currentChunk = this.buffer + input;
      let startIndex, endIndex;

      while (currentChunk.length > 0) {
        if (!this.buffering) {
          startIndex = currentChunk.indexOf(startToken);
          if (startIndex !== -1) {
            if (startIndex > 0) {
              yield currentChunk.slice(0, startIndex);
            }
            this.buffering = true;
            currentChunk = currentChunk.slice(startIndex);
          } else {
            yield currentChunk;
            currentChunk = '';
          }
        } else {
          endIndex = currentChunk.indexOf(endToken, startToken.length);
          if (endIndex !== -1) {
            let content = currentChunk.slice(0, endIndex + endToken.length);
            if (mapFn) {
              yield mapFn(content);
            } else {
              yield content;
            }
            this.buffering = false;
            currentChunk = currentChunk.slice(endIndex + endToken.length);
          } else {
            break;
          }
        }
      }

      this.buffer = currentChunk;
    };
  },

  accrue: () => new Dam,
  dam: () => new Dam
};
