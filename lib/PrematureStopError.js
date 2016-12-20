'use strict';

function PrematureStopError() {}

PrematureStopError.prototype = Object.create(Error.prototype);

module.exports = PrematureStopError;
