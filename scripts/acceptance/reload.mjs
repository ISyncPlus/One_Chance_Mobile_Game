import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const socket = new WebSocket('ws://127.0.0.1:8082/message', { origin: 'http://localhost:8082' });
socket.on('open', () => {
  socket.send(JSON.stringify({ version: 2, method: 'reload' }));
  setTimeout(() => socket.close(), 1000);
});
socket.on('error', (error) => { console.error(error); process.exitCode = 1; });
