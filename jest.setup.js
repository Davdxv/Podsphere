import 'regenerator-runtime/runtime';
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';

global.console = {
  ...console,
  // uncomment to ignore a specific log level in stdout
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

beforeAll(() => {
  global.originalArConnectState = process.env.REACT_APP_USE_ARCONNECT;
  global.disableArConnect();
});

afterAll(() => {
  global.resetArConnect();
});

afterEach(() => {
  jest.clearAllMocks();
});
