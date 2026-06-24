// Test setup: basic globals for happy-dom environment
globalThis.window = globalThis;
globalThis.document = globalThis.document || {};
// Provide a minimal console wrapper if needed
if (!globalThis.console) globalThis.console = console;
