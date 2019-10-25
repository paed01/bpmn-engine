'use strict';

module.exports = function getOptionsAndCallback(optionsOrCallback, callback) {
  var options;

  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
  } else {
    options = optionsOrCallback;
  }

  return [options, callback];
};