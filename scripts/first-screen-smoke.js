import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reportDir = path.join(rootDir, 'reports', 'performance')
const reportPath = path.join(reportDir, 'first-screen-smoke.md')
const metricsPath = path.join(reportDir, 'first-screen-smoke.json')
const screenshotPath = path.join(reportDir, 'first-screen-home.png')
const distIndexPath = path.join(rootDir, 'dist', 'index.html')
const appUrl = 'mappic://app/#/home'

if (!fsSync.existsSync(distIndexPath)) {
  console.error('Missing dist/index.html. Run `npm run build` before `npm run smoke:first-screen`.')
  process.exit(1)
}

await fs.mkdir(reportDir, { recursive: true })
await removeIfExists(metricsPath)
await removeIfExists(screenshotPath)

let server

try {
  server = await preview({
    root: rootDir,
    logLevel: 'error',
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: false
    }
  })

  const baseUrl = getPreviewUrl(server)

  await runElectron(baseUrl)

  const metrics = JSON.parse(await fs.readFile(metricsPath, 'utf8'))
  const checks = createChecks(metrics, appUrl)

  await writeReport({
    targetUrl: appUrl,
    previewUrl: baseUrl,
    checks,
    metrics
  })

  const failed = checks.filter((check) => !check.ok)

  if (failed.length) {
    console.error(`First-screen smoke failed: ${failed.length}/${checks.length}`)
    failed.forEach((check) => {
      console.error(`- ${check.name}: ${check.error}`)
    })
    process.exitCode = 1
  } else {
    console.log(`First-screen smoke passed: ${checks.length}/${checks.length}`)
  }

  console.log(`Report written to ${toRelative(reportPath)}`)
  console.log(`Screenshot written to ${toRelative(screenshotPath)}`)
} finally {
  await closePreview(server)
}

function getPreviewUrl(server) {
  const localUrl = server?.resolvedUrls?.local?.[0]

  if (localUrl) {
    return localUrl.endsWith('/') ? localUrl : `${localUrl}/`
  }

  const address = server?.httpServer?.address?.()
  const port = typeof address === 'object' && address ? address.port : 4173

  return `http://127.0.0.1:${port}/`
}

function runElectron(previewUrl) {
  const electronCliPath = path.join(rootDir, 'node_modules', 'electron', 'cli.js')

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [electronCliPath, '.'], {
      cwd: rootDir,
      env: {
        ...process.env,
        ELECTRON_ENABLE_LOGGING: 'false',
        MAPPIC_FIRST_SCREEN_SMOKE: '1',
        MAPPIC_FIRST_SCREEN_SMOKE_SCREENSHOT: screenshotPath,
        MAPPIC_FIRST_SCREEN_SMOKE_METRICS: metricsPath,
        VITE_DEV_SERVER_URL: previewUrl
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error([
        `Electron first-screen runner exited with code ${code}.`,
        stdout.trim(),
        stderr.trim()
      ].filter(Boolean).join('\n')))
    })
  })
}

function createChecks(metrics, targetUrl) {
  return [
    {
      name: 'loads the /home route',
      ok: metrics.url === targetUrl || metrics.url.endsWith('/home'),
      error: `expected ${targetUrl}, got ${metrics.url}`
    },
    {
      name: 'mounts the Vue app',
      ok: metrics.appChildCount > 0 && (metrics.appRect?.height ?? 0) > 300,
      error: `appChildCount=${metrics.appChildCount}, appHeight=${metrics.appRect?.height ?? 0}`
    },
    {
      name: 'renders visible text',
      ok: metrics.textLength > 20,
      error: `textLength=${metrics.textLength}`
    },
    {
      name: 'captures a painted screenshot',
      ok: metrics.screenshotBytes > 10000 && metrics.nonWhiteRatio > 0.02 && metrics.variedColorRatio > 0.05,
      error: `bytes=${metrics.screenshotBytes}, nonWhiteRatio=${metrics.nonWhiteRatio}, variedColorRatio=${metrics.variedColorRatio}`
    },
    {
      name: 'keeps the renderer alive',
      ok: (metrics.events?.pageErrors?.length ?? 0) === 0,
      error: JSON.stringify(metrics.events?.pageErrors ?? [])
    }
  ]
}

async function writeReport({ targetUrl, previewUrl, checks, metrics }) {
  const lines = [
    '# First Screen Smoke',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Target: \`${targetUrl}\``,
    `Preview: \`${previewUrl}\``,
    `Screenshot: \`${toRelative(screenshotPath)}\``,
    '',
    '| Check | Status | Detail |',
    '| --- | --- | --- |',
    ...checks.map((check) => (
      `| ${check.name} | ${check.ok ? 'PASS' : 'FAIL'} | ${check.ok ? '-' : escapeCell(check.error)} |`
    )),
    '',
    '## Metrics',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| elapsedMs | ${metrics.elapsedMs} |`,
    `| screenshotBytes | ${metrics.screenshotBytes} |`,
    `| screenshotSize | ${metrics.screenshotSize.width} x ${metrics.screenshotSize.height} |`,
    `| nonWhiteRatio | ${metrics.nonWhiteRatio} |`,
    `| variedColorRatio | ${metrics.variedColorRatio} |`,
    `| textLength | ${metrics.textLength} |`,
    `| appHeight | ${metrics.appRect?.height ?? 0} |`,
    `| consoleErrors | ${metrics.events?.consoleErrors?.length ?? 0} |`,
    `| failedLoads | ${metrics.events?.failedLoads?.length ?? 0} |`,
    ''
  ]

  await fs.writeFile(reportPath, lines.join('\n'), 'utf8')
}

function closePreview(server) {
  if (!server?.httpServer) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    server.httpServer.close(() => resolve())
  })
}

async function removeIfExists(filePath) {
  await fs.rm(filePath, { force: true })
}

function toRelative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/')
}

function escapeCell(value = '') {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}
