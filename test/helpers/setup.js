import 'chai/register-expect.js';

import nock from 'nock';

nock.enableNetConnect(/(localhost|127\.0\.0\.1):\d+/);
