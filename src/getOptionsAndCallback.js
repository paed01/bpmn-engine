'use strict';

module.exports = function getOptionsAndCallback(optionsOrCallback, callback) {
  let options;
  if (typeof optionsOrCallback === 'function') {
    callback = optionsOrCallback;
  } else {
    options = optionsOrCallback;
  }

  return [options, callback];
};
