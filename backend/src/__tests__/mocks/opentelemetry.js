// Mock for all @opentelemetry/* packages in tests
module.exports = new Proxy({}, {
  get: () => new Proxy(function() {}, {
    get: () => new Proxy(function() {}, { get: () => () => {} }),
    apply: () => ({}),
    construct: () => ({ start: () => {}, shutdown: () => Promise.resolve() }),
  }),
});
