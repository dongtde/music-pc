import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const runtimeFiles = [
  'package-lock.json',
  'src/start.js', 'src/app.js', 'src/config.js', 'src/rooms.js', 'src/protocol.js',
]

export async function copyRuntime(destination, { envExample = path.join(root, '.env.example') } = {}) {
  for (const relative of runtimeFiles) {
    const target = path.join(destination, relative)
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(path.join(root, relative), target)
  }
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  pkg.scripts = { start: pkg.scripts.start }
  await writeFile(path.join(destination, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  await copyFile(envExample, path.join(destination, '.env.example'))
}

async function main() {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '')
  const cache = path.join(root, 'node_modules', '.cache', 'release', stamp)
  const output = path.join(root, 'release')
  const archive = path.join(output, `lanyin-backend-${stamp}.tar.gz`)
  if (existsSync(cache) || existsSync(archive)) throw new Error('Build output already exists; retry with a new timestamp.')
  await mkdir(cache, { recursive: true })
  await mkdir(output, { recursive: true })
  await copyRuntime(path.join(cache, 'backend'))
  await copyFile(path.join(root, 'README.md'), path.join(cache, 'backend', 'README.md'))
  const result = spawnSync('tar', ['-czf', archive, '-C', cache, 'backend'], { stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Packaging failed with status ${result.status}.`)
  console.log(`Backend package: ${archive}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
