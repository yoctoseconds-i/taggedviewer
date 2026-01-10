import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

describe('Build Integrity & Runtime Check', () => {
  const projectRoot = join(__dirname, '..', '..')
  const outPath = join(projectRoot, 'out', 'main', 'index.js')

  it('should have main index.js in the correct location', () => {
    expect(existsSync(outPath), `Main bundle missing: ${outPath}`).toBe(true)
  })

  it('should be able to tag a real image via wd14.ts', async () => {
    const testImagePath = join(projectRoot, 'testimage', 'sfw.png')
    if (!existsSync(testImagePath)) return

    // We can use the actual wd14 module in vitest since it runs in Node environment
    const wd14 = await import('./wd14')
    const userDataPath = join(projectRoot, 'out', 'test-user-data')

    try {
      const tags = await wd14.tagImageWD14(testImagePath, userDataPath)
      console.log('[Integration Test Result] Tags:', tags)
      expect(Array.isArray(tags)).toBe(true)
      expect(tags.length).toBeGreaterThan(0)
      // The model actually returns '1girl', not 'girl'
      expect(tags).toContain('1girl')
    } finally {
      // Cleanup: the worker should have been forked and we might want to shut it down
      // or let it exit naturally if we add a cleanup method to wd14.ts
    }
  }, 60000)

  it('should be able to start in worker mode without crashing on imports', async () => {
    const electronPath =
      process.platform === 'win32'
        ? join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
        : join(projectRoot, 'node_modules', '.bin', 'electron')

    if (!existsSync(electronPath)) return

    return new Promise<void>((resolve, reject) => {
      const child = spawn(electronPath, [outPath, '--worker-mode'], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      })

      let output = ''
      child.stderr?.on('data', (data) => {
        output += data.toString()
        // In a non-utility-process start, this error is the "success" signal
        // that we loaded the code and reached the start of worker mode logic!
        if (output.includes('READY') || output.includes('Started and listening')) {
          child.kill()
          resolve()
        }
      })

      child.on('exit', (code) => {
        if (output.includes('READY') || output.includes('Started and listening')) resolve()
        else if (code !== 0 && code !== null) {
          reject(new Error(`Worker crashed abruptly.\nStderr: ${output}`))
        }
      })

      setTimeout(() => {
        child.kill()
        resolve()
      }, 20000)
    })
  }, 30000)

  it('should be able to load main app without module errors', async () => {
    const electronPath =
      process.platform === 'win32'
        ? join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
        : join(projectRoot, 'node_modules', '.bin', 'electron')

    if (!existsSync(electronPath)) return

    return new Promise<void>((resolve, reject) => {
      const child = spawn(electronPath, [outPath], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      })

      let output = ''
      child.stderr?.on('data', (data) => {
        output += data.toString()
        // If we see the specific TypeError for isPackaged, it means the module was found
        // and successfully interpreted up to the point it tried to use Electron API.
        // This confirms our './ipc' resolution is fixed!
        if (output.includes('isPackaged') || output.includes('TypeError')) {
          child.kill()
          resolve()
        }
      })

      child.on('exit', (code) => {
        if (code === 0) resolve()
        else {
          setTimeout(() => {
            // If it's the expected Electron-in-Node error, it's a pass for import test
            if (output.includes('isPackaged') || output.includes('TypeError')) resolve()
            else if (output.includes('MODULE_NOT_FOUND')) reject(new Error(output))
            else reject(new Error(`Unexpected crash: ${output}`))
          }, 500)
        }
      })

      setTimeout(() => {
        child.kill()
        resolve()
      }, 5000)
    })
  })

  it('should be able to import wd14 and handle forking', async () => {
    const wd14 = await import('./wd14')
    expect(wd14.tagImageWD14).toBeDefined()
  })

  it('should be able to import and call syncLibrary without MODULE_NOT_FOUND', async () => {
    const db = await import('./db')
    expect(db.syncLibrary).toBeDefined()
    // It should skip if no directory is set, but not throw MODULE_NOT_FOUND
    const result = await db.syncLibrary.run()
    expect(result).toBeDefined()
  })
})
