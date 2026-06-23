import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createServer } from 'vite'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reportDir = path.join(rootDir, 'reports', 'performance')
const reportPath = path.join(reportDir, 'route-smoke.md')
const vite = await createServer({
  root: rootDir,
  appType: 'custom',
  logLevel: 'error',
  server: {
    middlewareMode: true
  }
})

const { routes } = await vite.ssrLoadModule('/src/router/routes.js')
const router = createRouter({
  history: createMemoryHistory(),
  routes
})

const routeCases = [
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'home' },
  { path: '/search', redirect: '/home' },
  { path: '/search/周杰伦', redirect: '/home' },
  { path: '/discover', name: 'discover' },
  { path: '/discover/charts', name: 'discover', params: { tab: 'charts' } },
  { path: '/fm', redirect: '/home' },
  { path: '/podcast', name: 'podcast' },
  { path: '/podcast/rank', name: 'podcast-rank' },
  { path: '/podcast/sleep', name: 'podcast-sleep' },
  { path: '/podcast/radio', name: 'podcast-radio' },
  { path: '/podcast/123', name: 'podcast-detail', params: { id: '123' } },
  { path: '/mv', name: 'video' },
  { path: '/video', name: 'video' },
  { path: '/library/recent', name: 'library', params: { type: 'recent' } },
  { path: '/playlist/123', name: 'playlist', params: { id: '123' } },
  { path: '/album/123', name: 'album', params: { id: '123' } },
  { path: '/artist/123', name: 'artist', params: { id: '123' } },
  { path: '/settings', name: 'settings' },
  { path: '/desktop-lyrics', name: 'desktop-lyrics' },
  { path: '/missing-route', name: 'not-found', params: { pathMatch: ['missing-route'] } }
]

const requiredNames = [
  'home',
  'discover',
  'podcast',
  'podcast-rank',
  'podcast-sleep',
  'podcast-radio',
  'podcast-detail',
  'video',
  'library',
  'playlist',
  'album',
  'artist',
  'settings',
  'desktop-lyrics',
  'not-found'
]

const checks = [
  ...routeCases.map(checkRoutePath),
  ...requiredNames.map(checkRouteName)
]

await vite.close()
await writeReport()

const failed = checks.filter((check) => !check.ok)

if (failed.length) {
  console.error(`Route smoke failed: ${failed.length}/${checks.length}`)
  failed.forEach((check) => {
    console.error(`- ${check.name}: ${check.error}`)
  })
  process.exit(1)
}

console.log(`Route smoke passed: ${checks.length}/${checks.length}`)
console.log(`Report written to ${path.relative(rootDir, reportPath).replace(/\\/g, '/')}`)

function checkRoutePath(testCase) {
  const resolved = router.resolve(testCase.path)

  if (testCase.redirect) {
    const redirect = resolved.matched[0]?.redirect
    return {
      name: `${testCase.path} redirects to ${testCase.redirect}`,
      ok: redirect === testCase.redirect,
      error: redirect === testCase.redirect ? '' : `expected redirect ${testCase.redirect}, got ${redirect || 'none'}`
    }
  }

  const paramsOk = Object.entries(testCase.params ?? {}).every(
    ([key, value]) => String(resolved.params[key] ?? '') === String(value)
  )
  const ok = Boolean(resolved.matched.length) && resolved.name === testCase.name && paramsOk

  return {
    name: `${testCase.path} resolves to ${testCase.name}`,
    ok,
    error: ok
      ? ''
      : `matched=${resolved.matched.length}, name=${String(resolved.name)}, params=${JSON.stringify(resolved.params)}`
  }
}

function checkRouteName(name) {
  const exists = router.hasRoute(name)

  return {
    name: `route name ${name} exists`,
    ok: exists,
    error: exists ? '' : 'missing named route'
  }
}

async function writeReport() {
  await fs.mkdir(reportDir, { recursive: true })

  const lines = [
    '# Route Smoke',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Check | Status | Detail |',
    '| --- | --- | --- |',
    ...checks.map((check) => (
      `| ${check.name} | ${check.ok ? 'PASS' : 'FAIL'} | ${check.ok ? '-' : escapeCell(check.error)} |`
    )),
    ''
  ]

  await fs.writeFile(reportPath, lines.join('\n'), 'utf8')
}

function escapeCell(value = '') {
  return String(value).replace(/\|/g, '\\|')
}
