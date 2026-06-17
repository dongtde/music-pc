const { spawn } = require('node:child_process');

const devServerPort = Number(process.env.VITE_DEV_SERVER_PORT) || 5174;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || `http://127.0.0.1:${devServerPort}`;

const vite = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js',
  '--host',
  '127.0.0.1',
  '--port',
  String(devServerPort),
  '--strictPort',
  '--mode',
  'desktop',
], {
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    VITE_DEV_SERVER_PORT: String(devServerPort),
  },
});

let electron = null;
let stopping = false;

waitForDevServer()
  .then(() => {
    electron = spawn(process.execPath, ['node_modules/electron/cli.js', '.'], {
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        MAPPIC_DESKTOP_DEBUG: '1',
        VITE_DEV_SERVER_URL: devServerUrl,
      },
    });

    electron.on('exit', (code) => {
      stop();
      process.exit(code ?? 0);
    });
  })
  .catch((error) => {
    console.error(error);
    stop();
    process.exit(1);
  });

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

function stop() {
  if (stopping) {
    return;
  }

  stopping = true;
  electron?.kill();
  vite.kill();
}

async function waitForDevServer() {
  const startedAt = Date.now();
  const timeout = 30000;

  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(devServerUrl);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling while Vite starts.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${devServerUrl}`);
}
