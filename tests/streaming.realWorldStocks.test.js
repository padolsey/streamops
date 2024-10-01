const createStreamOps = require('../src/createStreamOps');

describe('waitUntil Operator', () => {
  let streamOps;

  beforeEach(() => {
    streamOps = createStreamOps();
  });

  describe('Real-time Stock Trading Scenario', () => {
    test('Processes stock data and makes trading decisions', async () => {
      const mockDataStream = function* () {
        yield { type: 'price', value: 150.25 };
        yield { type: 'volume', value: 1000000 };
        yield { type: 'sentiment', value: 0.75 };
        yield { type: 'marketTrend', value: 'bullish' };
        yield { type: 'price', value: 152.50 };
        yield { type: 'volume', value: 1100000 };
        yield { type: 'sentiment', value: 0.80 };
        yield { type: 'marketTrend', value: 'bullish' };
      };

      const decideTrade = (data) => {
        const price = data.find(item => item.type === 'price').value;
        const volume = data.find(item => item.type === 'volume').value;
        const sentiment = data.find(item => item.type === 'sentiment').value;
        const marketTrend = data.find(item => item.type === 'marketTrend').value;

        if (price > 151 && volume > 1000000 && sentiment > 0.7 && marketTrend === 'bullish') {
          return { action: 'buy', quantity: 100 };
        }
        return { action: 'hold' };
      };

      const executedTrades = [];

      const tradingDecisionPipeline = [
        mockDataStream,
        streamOps.waitUntil(buffer => 
          buffer.some(item => item.type === 'price') &&
          buffer.some(item => item.type === 'volume') &&
          buffer.some(item => item.type === 'sentiment') &&
          buffer.some(item => item.type === 'marketTrend')
        ),
        streamOps.tap(data => console.log('Data after waitUntil:', data)),
        streamOps.map(decideTrade),
        streamOps.tap(decision => console.log('Decision:', decision)),
        streamOps.filter(decision => decision.action !== 'hold'),
        streamOps.tap(trade => executedTrades.push(trade))
      ];

      const results = [];
      for await (const item of streamOps(tradingDecisionPipeline)) {
        results.push(item);
      }

      console.log('Final results:', results);
      console.log('Executed trades:', executedTrades);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ action: 'buy', quantity: 100 });
      expect(executedTrades).toEqual([{ action: 'buy', quantity: 100 }]);
    });

    test('Handles multiple trading cycles', async () => {
      const mockDataStream = function* () {
        // First cycle
        yield { type: 'price', value: 150.25 };
        yield { type: 'volume', value: 1000000 };
        yield { type: 'sentiment', value: 0.75 };
        yield { type: 'marketTrend', value: 'bullish' };
        // Second cycle
        yield { type: 'price', value: 152.50 };
        yield { type: 'volume', value: 1100000 };
        yield { type: 'sentiment', value: 0.80 };
        yield { type: 'marketTrend', value: 'bullish' }; // Changed to 'bullish'
        // Third cycle
        yield { type: 'price', value: 149.00 }; // Changed to 149.00
        yield { type: 'volume', value: 900000 };
        yield { type: 'sentiment', value: 0.60 };
        yield { type: 'marketTrend', value: 'bearish' };
      };

      const decideTrade = (data) => {
        const price = data.find(item => item.type === 'price').value;
        const volume = data.find(item => item.type === 'volume').value;
        const sentiment = data.find(item => item.type === 'sentiment').value;
        const marketTrend = data.find(item => item.type === 'marketTrend').value;

        if (price > 152 && volume > 1000000 && sentiment > 0.7 && marketTrend === 'bullish') {
          return { action: 'buy', quantity: 100 };
        } else if (price < 150 && volume < 1000000 && sentiment < 0.7) {
          return { action: 'sell', quantity: 50 };
        }
        return { action: 'hold' };
      };

      const tradingDecisionPipeline = [
        mockDataStream,
        streamOps.waitUntil(buffer => 
          buffer.some(item => item.type === 'price') &&
          buffer.some(item => item.type === 'volume') &&
          buffer.some(item => item.type === 'sentiment') &&
          buffer.some(item => item.type === 'marketTrend')
        ),
        streamOps.tap(data => console.log('Data after waitUntil:', data)),
        streamOps.map(decideTrade),
        streamOps.tap(decision => console.log('Decision:', decision)),
        streamOps.filter(decision => decision.action !== 'hold')
      ];

      const results = [];
      for await (const item of streamOps(tradingDecisionPipeline)) {
        results.push(item);
      }

      console.log('Final results:', results);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ action: 'buy', quantity: 100 });
      expect(results[1]).toEqual({ action: 'sell', quantity: 50 });
    });
  });
});