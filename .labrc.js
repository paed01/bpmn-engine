'use strict';

require('nock').enableNetConnect(/(localhost|127\.0\.0\.1):\d+/);

if (process.env.UNNECESSARY) {
  const Unnecessary = require("unnecessary");
  const unnecessary = new Unnecessary({
    excludeDirs: ["tmp"],
    excludeFiles: [
      "generate-api-toc.js"
    ]
  });

  process.on("exit", (code, signal) => {
    if (!signal && code === 0) {
      log(unnecessary);
    }
  });
}

function log(unnecessary) {
  /* eslint no-console:0 */
  let untouched = unnecessary.untouched();
  if (!untouched.length) return;
  console.log(`\n\x1b[31mFound ${untouched.length} potentially unused file${untouched.length > 1 ? "s" : ""}:\x1b[0m`);
  unnecessary.untouched().forEach((file) => {
    console.log(`  \x1b[33m${file}\x1b[0m`);
  });
}

module.exports = {
  timeout: 1000,
  verbose: true
};
