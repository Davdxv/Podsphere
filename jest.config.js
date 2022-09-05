const path = require('path');
require('dotenv').config();

module.exports = {
  testPathIgnorePatterns: ['cypress'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  setupFilesAfterEnv: [
    path.resolve('jest.helpers.js'),
    path.resolve('jest.setup.js'),
  ],
};
