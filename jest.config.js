'use strict';

const path = require('path');

module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: [
    'jest-environment-jsdom',
    'jest-date-mock',
  ],
  setupFilesAfterEnv: [path.resolve('jest.setup.js')],
  testURL: 'https://thejimmydoreshow.libsyn.com/',
  transform: {
    '\\.jsx?$': 'babel-jest',
  },
};