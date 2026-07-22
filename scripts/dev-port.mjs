import { spawn } from 'node:child_process';
import net from 'node:net';

const START_PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const forwardedArgs = process.argv.slice(2);

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, HOST);
  });
}

async function findOpenPort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await canListen(port)) return port;
  }

  throw new Error(`No open port found from ${startPort} to ${startPort + 99}.`);
}

const port = await findOpenPort(START_PORT);
const vite = spawn('vite', ['--host', HOST, '--port', String(port), ...forwardedArgs], {
  stdio: 'inherit',
  shell: true,
});

vite.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
