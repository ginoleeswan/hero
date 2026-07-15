// No-op Sentry mock for jest (init guards on NODE_ENV==='test' anyway, but the
// native module must not load under jsdom). Mirrors the plain-CommonJS style of
// the repo's other manual mocks (see __mocks__/svgMock.js).
module.exports = {
  init: () => {},
  captureException: () => {},
  captureMessage: () => {},
  setTag: () => {},
  setContext: () => {},
  wrap: (component) => component,
};
