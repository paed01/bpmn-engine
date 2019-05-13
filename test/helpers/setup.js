'use strict';

process.env.NODE_ENV = 'test';
Error.stackTraceLimit = 20;
global.expect = require('chai').expect;
