import { build, loadEnv } from 'vite'
import { mkdir, readFile, writeFile, copyFile, readdir, stat, cp, lstat, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { copyRuntime } from '../../backend/scripts/build.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const templates = path.join(root, 'deploy', 'baota')
const env = loadEnv('production', root, '')

function upstream(primary, fallback) {
  const value = env[primary] || env[fallback]
  if (!value) throw new Error(`Configure ${primary} in your local environment before packaging.`)
  let url
  try { url = new URL(value) }
  catch { throw new Error(`${primary} must be a valid HTTP(S) upstream.`) }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || /[\s;{}$'"\\]/.test(url.href)) {
    throw new Error(`${primary} must be an HTTP(S) upstream without credentials, query parameters, or Nginx control characters.`)
  }
  return { target: url.href.replace(/\/+$/, ''), host: url.hostname }
}

const kugou = upstream('VITE_KUGOU_API_TARGET', 'KUGOU_API_TARGET')
const netease = upstream('VITE_NETEASE_API_TARGET', 'NETEASE_API_TARGET')
const stamp = new Date().toISOString().replace(/[-:.]/g, '')
const outputBase = path.join(root, 'release', 'server')
const cache = path.join(root, 'node_modules', '.cache', 'baota-package', stamp)
const staging = path.join(cache, 'staging')
const bundle = path.join(staging, 'lanyin')
const archive = path.join(outputBase, `lanyin-baota-${stamp}.tar.gz`)
const frontend = path.join(root, 'dist')
const relativeOutput = path.relative(root, cache)
if (relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput) || existsSync(staging) || existsSync(archive)) {
  throw new Error('The package output must be a new directory within this workspace.')
}
await mkdir(bundle, { recursive: true })
await mkdir(outputBase, { recursive: true })
if (existsSync(frontend) && (await lstat(frontend)).isSymbolicLink()) {
  throw new Error('The frontend output must be a regular dist directory within this project.')
}

// Build public settings separately from private local upstream configuration.
const isolatedEnvDir = path.join(cache, 'env')
await mkdir(isolatedEnvDir, { recursive: true })
const previousPublicEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('VITE_')))
for (const key of Object.keys(previousPublicEnv)) delete process.env[key]
Object.assign(process.env, {
  VITE_KUGOU_API_BASE: '/api',
  VITE_NETEASE_API_BASE: '/netease-api',
  VITE_API_TIMEOUT: '120000',
  VITE_LISTENING_SERVER_URL: '',
})
try {
  await build({
    root,
    configFile: path.join(root, 'vite.config.js'),
    configLoader: 'native',
    mode: 'production',
    envDir: isolatedEnvDir,
    build: { outDir: frontend, emptyOutDir: true },
  })
} finally {
  for (const key of Object.keys(process.env)) if (key.startsWith('VITE_')) delete process.env[key]
  Object.assign(process.env, previousPublicEnv)
}

await cp(frontend, path.join(bundle, 'frontend'), { recursive: true })
await copyRuntime(path.join(bundle, 'backend'), { envExample: path.join(templates, 'backend.env.example') })
await mkdir(path.join(bundle, 'config'), { recursive: true })
const proxyTemplate = await readFile(path.join(templates, 'nginx-locations.conf.template'), 'utf8')
const proxy = proxyTemplate
  .replaceAll('__KUGOU_TARGET__', kugou.target).replaceAll('__KUGOU_HOST__', kugou.host)
  .replaceAll('__NETEASE_TARGET__', netease.target).replaceAll('__NETEASE_HOST__', netease.host)
await writeFile(path.join(bundle, 'config', 'nginx-locations.conf'), proxy)
await copyFile(path.join(root, 'docs', 'baota-deployment.md'), path.join(bundle, 'DEPLOY.md'))

async function filesIn(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await filesIn(file))
    else if (entry.isFile()) result.push(file)
    else throw new Error('Packages must contain only ordinary files and directories.')
  }
  return result
}
const files = await filesIn(bundle)
for (const file of files) {
  const relative = path.relative(bundle, file).replaceAll('\\', '/')
  if (/(^|\/)(node_modules|\.vercel|\.git)(\/|$)/.test(relative) || /(^|\/)\.env(?!\.example$)/.test(relative)) {
    throw new Error(`Unexpected private or dependency file: ${relative}`)
  }
}
for (const file of files.filter(file => file.startsWith(path.join(bundle, 'frontend') + path.sep) && /\.(js|html|css|json|map)$/.test(file))) {
  const content = await readFile(file, 'utf8')
  if (content.includes(kugou.target) || content.includes(netease.target) || /VITE_(?:KUGOU|NETEASE)_API_TARGET/.test(content)) {
    throw new Error('Private music upstream configuration must not enter the frontend bundle.')
  }
}
const manifest = {
  generatedAt: new Date().toISOString(),
  platform: 'OpenCloudOS 9 with BaoTa Panel 13',
  node: '22 or later',
  frontendBase: '/',
  backendListen: '127.0.0.1:3030',
  roomCapacity: 10,
  musicApiMode: 'existing upstreams through Nginx',
  files: files.map(file => path.relative(bundle, file).replaceAll('\\', '/')),
}
await writeFile(path.join(bundle, 'config', 'package-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

const tar = spawnSync('tar', ['-czf', archive, '-C', staging, 'lanyin'], { stdio: 'inherit', windowsHide: true })
if (tar.error) throw tar.error
if (tar.status !== 0) throw new Error(`tar failed with status ${tar.status}; the unpacked package remains at ${bundle}`)
await rm(cache, { recursive: true, force: true })
console.log(JSON.stringify({ archive, frontend, files: files.length + 1, sizeMiB: Number(((await stat(archive)).size / 1024 / 1024).toFixed(2)) }, null, 2))
