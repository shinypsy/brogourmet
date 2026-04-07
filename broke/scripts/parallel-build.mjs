/**
 * `tsc -b`와 `vite build`를 동시에 실행해 wall-clock 빌드 시간을 줄입니다.
 * (.cmd + shell 없이 node로 CLI 진입 — Windows DEP0190 회피)
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tscCli = path.join(root, 'node_modules', 'typescript', 'lib', 'tsc.js')
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

function runNode(label, scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: root,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${label} exited with code ${code}`))
    })
  })
}

try {
  await Promise.all([runNode('TypeScript', tscCli, ['-b']), runNode('Vite', viteCli, ['build'])])
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}
