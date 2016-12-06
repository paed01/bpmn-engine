'use strict';

const util = require('util');

function PrematureStopError() {}
util.inherits(PrematureStopError, Error);

module.exports = PrematureStopError;
