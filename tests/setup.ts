import { JSDOM } from 'jsdom';

const { window } = new JSDOM('', { url: 'http://localhost' });
// Assign globals for tests running in Node environment
(global as any).window = window;
(global as any).document = window.document;
(global as any).localStorage = window.localStorage;
(global as any).sessionStorage = window.sessionStorage;
