const createStreamOps = require('./createStreamOps');
const StreamOpsError = require('./StreamOpsError');
const {operators} = require('./operators');

module.exports = async function*(pipelineCreator, streamOpsConfig) {

  if (Array.isArray(pipelineCreator) || pipelineCreator == null) {
    yield* createStreamOps(streamOpsConfig)(pipelineCreator);
    return;
  }

  if (typeof pipelineCreator !== 'function') {
    throw new StreamOpsError(
      'Your pipeline creator must be a function that returns an array. ' +
      'You passed a value of type: ' + typeof pipelineCreator
    );
  }

  const pipeline = await pipelineCreator(operators);

  if (!Array.isArray(pipeline)) {
    throw new StreamOpsError('Your pipeline creator should return an array');
  }

  const stream = createStreamOps(streamOpsConfig)(pipeline);

  yield* stream;

};