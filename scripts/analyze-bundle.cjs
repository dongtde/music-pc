#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const rootDir = path.resolve(__dirname, '..')
const args = parseArgs(process.argv.slice(2))
const distDir = path.resolve(rootDir, args.dist || 'dist')
const reportDir = path.resolve(rootDir, args.out || 'reports/performance')
const jsonReportPath = path.join(reportDir, 'bundle-baseline.json')
const markdownReportPath = path.join(reportDir, 'bundle-baseline.md')

if (!fs.existsSync(distDir)) {
  console.error(`Cannot find build output: ${distDir}`)
  console.error('Run `npm run build` before analyzing the bundle.')
  process.exit(1)
}

const files = walkFiles(distDir)
  .filter((filePath) => !filePath.endsWith('.map'))
  .map(readBundleFile)
  .sort((a, b) => b.bytes - a.bytes)

const generatedAt = new Date().toISOString()
const totals = summarize(files)
const byType = Object.entries(groupBy(files, (file) => file.type))
  .map(([type, typeFiles]) => ({
    type,
    ...summarize(typeFiles)
  }))
  .sort((a, b) => b.bytes - a.bytes)

const report = {
  generatedAt,
  dist: normalizePath(path.relative(rootDir, distDir)),
  totals,
  byType,
  files
}

fs.mkdirSync(reportDir, { recursive: true })
fs.writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`)
fs.writeFileSync(markdownReportPath, renderMarkdownReport(report))

console.log(`Bundle baseline written to ${normalizePath(path.relative(rootDir, markdownReportPath))}`)
console.log(`Total: ${formatBytes(totals.bytes)} raw, ${formatBytes(totals.gzipBytes)} gzip, ${formatBytes(totals.brotliBytes)} brotli`)

function parseArgs(argv) {
  const parsed = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (!arg.startsWith('--')) {
      continue
    }

    const [name, inlineValue] = arg.slice(2).split('=')
    const value = inlineValue ?? argv[index + 1]

    if (inlineValue === undefined) {
      index += 1
    }

    parsed[name] = value
  }

  return parsed
}

function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return walkFiles(entryPath)
    }

    if (entry.isFile()) {
      return [entryPath]
    }

    return []
  })
}

function readBundleFile(filePath) {
  const buffer = fs.readFileSync(filePath)
  const relativePath = normalizePath(path.relative(distDir, filePath))
  const extension = path.extname(filePath).toLowerCase()

  return {
    file: relativePath,
    type: getFileType(relativePath, extension),
    bytes: buffer.length,
    gzipBytes: zlib.gzipSync(buffer, { level: 9 }).length,
    brotliBytes: zlib.brotliCompressSync(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11
      }
    }).length
  }
}

function getFileType(relativePath, extension) {
  if (extension === '.js') {
    return 'js'
  }

  if (extension === '.css') {
    return 'css'
  }

  if (extension === '.html') {
    return 'html'
  }

  if (extension === '.json' || extension === '.webmanifest') {
    return 'manifest'
  }

  if (relativePath.includes('/pwa/') || ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico'].includes(extension)) {
    return 'asset'
  }

  return 'other'
}

function summarize(fileList) {
  return fileList.reduce(
    (summary, file) => ({
      count: summary.count + 1,
      bytes: summary.bytes + file.bytes,
      gzipBytes: summary.gzipBytes + file.gzipBytes,
      brotliBytes: summary.brotliBytes + file.brotliBytes
    }),
    {
      count: 0,
      bytes: 0,
      gzipBytes: 0,
      brotliBytes: 0
    }
  )
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item)

    if (!groups[key]) {
      groups[key] = []
    }

    groups[key].push(item)
    return groups
  }, {})
}

function renderMarkdownReport(report) {
  const sections = [
    '# Bundle Baseline',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Build output: \`${report.dist}\``,
    '',
    '## Totals',
    '',
    renderSummaryTable([
      {
        label: 'All files',
        ...report.totals
      },
      ...report.byType.map((item) => ({
        label: item.type,
        ...item
      }))
    ]),
    '',
    '## Largest Files',
    '',
    renderFileTable(report.files.slice(0, 20)),
    '',
    '## Largest JavaScript',
    '',
    renderFileTable(report.files.filter((file) => file.type === 'js').slice(0, 15)),
    '',
    '## Largest CSS',
    '',
    renderFileTable(report.files.filter((file) => file.type === 'css').slice(0, 15)),
    '',
    '## Usage',
    '',
    '- Run `npm run baseline:bundle` after optimization batches.',
    '- Compare `reports/performance/bundle-baseline.json` between runs for exact byte deltas.',
    ''
  ]

  return `${sections.join('\n')}\n`
}

function renderSummaryTable(rows) {
  return [
    '| Scope | Files | Raw | Gzip | Brotli |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows.map((row) =>
      `| ${row.label} | ${row.count} | ${formatBytes(row.bytes)} | ${formatBytes(row.gzipBytes)} | ${formatBytes(row.brotliBytes)} |`
    )
  ].join('\n')
}

function renderFileTable(fileList) {
  if (!fileList.length) {
    return '_No files._'
  }

  return [
    '| File | Type | Raw | Gzip | Brotli |',
    '| --- | --- | ---: | ---: | ---: |',
    ...fileList.map((file) =>
      `| \`${file.file}\` | ${file.type} | ${formatBytes(file.bytes)} | ${formatBytes(file.gzipBytes)} | ${formatBytes(file.brotliBytes)} |`
    )
  ].join('\n')
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/')
}
