import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reportDir = path.join(rootDir, 'reports', 'performance')
const reportPath = path.join(reportDir, 'home-fps-smoke.md')
const metricsPath = path.join(reportDir, 'home-fps-smoke.json')
const distIndexPath = path.join(rootDir, 'dist', 'index.html')
const appUrl = 'mappic://app/#/home'

if (!fsSync.existsSync(distIndexPath)) {
  console.error('Missing dist/index.html. Run `npm run build` before `npm run smoke:fps`.')
  process.exit(1)
}

await fs.mkdir(reportDir, { recursive: true })
await fs.rm(metricsPath, { force: true })

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

  const previewUrl = getPreviewUrl(server)

  await runElectron(previewUrl)

  const metrics = JSON.parse(await fs.readFile(metricsPath, 'utf8'))
  const checks = createChecks(metrics)

  await writeReport({ previewUrl, checks, metrics })

  const failed = checks.filter((check) => !check.ok)

  if (failed.length) {
    console.error(`Home FPS smoke failed: ${failed.length}/${checks.length}`)
    failed.forEach((check) => {
      console.error(`- ${check.name}: ${check.error}`)
    })
    process.exitCode = 1
  } else {
    console.log(`Home FPS smoke passed: ${checks.length}/${checks.length}`)
  }

  console.log(`Report written to ${toRelative(reportPath)}`)
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
        MAPPIC_ELECTRON_SMOKE_MODE: 'fps',
        MAPPIC_FPS_SMOKE_METRICS: metricsPath,
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
        `Electron FPS runner exited with code ${code}.`,
        stdout.trim(),
        stderr.trim()
      ].filter(Boolean).join('\n')))
    })
  })
}

function createChecks(metrics) {
  const checks = [
    {
      name: 'loads the /home route',
      ok: metrics.url === appUrl || metrics.url.endsWith('/home'),
      error: `expected ${appUrl}, got ${metrics.url}`
    },
    createScrollerCheck(metrics.music, 'home music feed'),
    createFpsCheck(metrics.music?.idle, 'home music idle FPS'),
    createFpsCheck(metrics.music?.scroll, 'home music scroll FPS'),
    createFpsCheck(metrics.music?.recovery, 'home music recovery FPS')
  ]

  if (metrics.video?.found) {
    checks.push(
      createScrollerCheck(metrics.video, 'home video feed'),
      {
        name: 'home video hydration window',
        ok: Number(metrics.video.hydratedCount) > 0 && Number(metrics.video.hydratedCount) <= 5,
        error: `hydratedCount=${metrics.video.hydratedCount}`
      },
      createFpsCheck(metrics.video?.idle, 'home video idle FPS'),
      createFpsCheck(metrics.video?.scroll, 'home video scroll FPS')
    )
  }

  return checks
}

function createScrollerCheck(sample, name) {
  return {
    name: `${name} exists`,
    ok: Boolean(sample?.found && sample.childCount > 0 && sample.clientHeight > 0),
    error: `found=${sample?.found}, childCount=${sample?.childCount}, clientHeight=${sample?.clientHeight}`
  }
}

function createFpsCheck(sample, name) {
  return {
    name,
    ok: Number(sample?.fps) >= 20,
    error: `fps=${sample?.fps}, frames=${sample?.frames}, durationMs=${sample?.durationMs}`
  }
}

async function writeReport({ previewUrl, checks, metrics }) {
  const lines = [
    '# Home FPS Smoke',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Target: \`${appUrl}\``,
    `Preview: \`${previewUrl}\``,
    '',
    '| Check | Status | Detail |',
    '| --- | --- | --- |',
    ...checks.map((check) => (
      `| ${check.name} | ${check.ok ? 'PASS' : 'FAIL'} | ${check.ok ? '-' : escapeCell(check.error)} |`
    )),
    '',
    '## Metrics',
    '',
    '| Area | Sample | FPS | Frames | Duration | Long Frames | Max Frame Delta |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...fpsRows(metrics.music),
    ...fpsRows(metrics.video),
    '',
    '## Scrollers',
    '',
    '| Area | Found | Children | Hydrated | Client Height | Scroll Height |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    scrollerRow(metrics.music),
    scrollerRow(metrics.video),
    ''
  ]

  await fs.writeFile(reportPath, lines.join('\n'), 'utf8')
}

function fpsRows(area) {
  if (!area?.found) {
    return []
  }

  return ['idle', 'scroll', 'recovery']
    .filter((key) => area[key])
    .map((key) => {
      const sample = area[key]

      return `| ${area.label} | ${key} | ${sample.fps} | ${sample.frames} | ${sample.durationMs} ms | ${sample.longFrames} | ${sample.maxFrameDeltaMs} ms |`
    })
}

function scrollerRow(area = {}) {
  return `| ${area.label || '-'} | ${area.found ? 'yes' : 'no'} | ${area.childCount || 0} | ${area.hydratedCount || 0} | ${area.clientHeight || 0} | ${area.scrollHeight || 0} |`
}

function closePreview(server) {
  if (!server?.httpServer) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    server.httpServer.close(() => resolve())
  })
}

function toRelative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/')
}

function escapeCell(value = '') {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}
