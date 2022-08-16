/**
 * Global Jest variables and helper functions. See jest.setup.js for global hooks.
 */

global.enableArConnect = () => {
  Object.assign(process.env, { REACT_APP_USE_ARCONNECT: 'true' });
};

global.disableArConnect = () => {
  Object.assign(process.env, { REACT_APP_USE_ARCONNECT: 'false' });
};

global.resetArConnect = () => {
  process.env.REACT_APP_USE_ARCONNECT = global.originalArConnectState;
};

global.podcastId = (podcastNumber = 1) => `00000000-0000-0000-0000-${`${podcastNumber}`
  .padStart(12, '0')}`;

global.VALID_ID = expect.stringMatching(/^[a-fA-F0-9]{4,}/);
global.VALID_TEMP_ID = expect.stringMatching(/^temp-[a-fA-F0-9]{4,}/);
