'use strict';

require('nock').enableNetConnect(/(localhost|127\.0\.0\.1):\d+/);

module.exports = {
  timeout: 1000,
  verbose: true
};
