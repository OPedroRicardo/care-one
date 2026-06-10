import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.resolve(__dirname, '../../../analysis/compute_dashboard.py')
const CACHE_TTL_MS = 15 * 60 * 1000

interface CacheEntry {
  data: unknown[]
  ts: number
}

let cache: CacheEntry | null = null
let pending: Promise<unknown[]> | null = null
let pythonCmd: string | null = null

const PYTHON_CANDIDATES = [
  process.platform === 'win32'
    ? path.join(process.env['USERPROFILE'] ?? 'C:\\Users\\pe', '.pyenv', 'pyenv-win', 'shims', 'python.bat')
    : null,
  'python',
  'py',
  'python3',
].filter(Boolean) as string[]

function tryCmd(cmd: string): Promise<boolean> {
  return new Promise(resolve => {
    const p = spawn(cmd, ['--version'], { stdio: 'ignore', shell: true })
    p.on('close', code => resolve(code === 0))
    p.on('error', () => resolve(false))
  })
}

async function resolvePython(): Promise<string> {
  if (pythonCmd) return pythonCmd
  for (const cmd of PYTHON_CANDIDATES) {
    if (await tryCmd(cmd)) { pythonCmd = cmd; return cmd }
  }
  throw new Error('Python 3 not found. Install Python and add it to PATH.')
}

async function runPython(): Promise<unknown[]> {
  const py = await resolvePython()
  return new Promise((resolve, reject) => {
    const proc = spawn(py, [SCRIPT], { stdio: ['ignore', 'pipe', 'pipe'], shell: true })
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    proc.stdout.on('data', (c: Buffer) => chunks.push(c))
    proc.stderr.on('data', (c: Buffer) => errChunks.push(c))

    proc.on('close', (code) => {
      const stderr = Buffer.concat(errChunks).toString()
      if (code !== 0) {
        reject(new Error(`compute_dashboard.py exited ${code}: ${stderr.slice(0, 400)}`))
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error(`Invalid JSON from analysis script. stderr: ${stderr.slice(0, 200)}`))
      }
    })

    proc.on('error', reject)
  })
}

export async function getPatients(): Promise<unknown[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data

  if (pending) return pending

  pending = runPython()
    .then((data) => {
      cache = { data, ts: Date.now() }
      pending = null
      return data
    })
    .catch((err) => {
      pending = null
      throw err
    })

  return pending
}

export function invalidateCache() {
  cache = null
}
