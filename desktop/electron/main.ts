import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

type DaemonResponse = {
  ok: boolean
  id?: string
  stdout?: string
  stderr?: string
  result?: unknown
  error?: string
  traceback?: string
}

let daemonProc: ReturnType<typeof spawn> | null = null
let daemonStdoutBuf = ''
const pending = new Map<string, { resolve: (v: DaemonResponse) => void; reject: (e: Error) => void }>()

function getDaemon(backendDir: string, scriptPath: string, pythonCmd: string) {
  if (daemonProc && !daemonProc.killed) return daemonProc

  daemonProc = spawn(pythonCmd, [scriptPath, '--daemon'], {
    cwd: backendDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    },
  })

  daemonStdoutBuf = ''

  const proc = daemonProc
  if (!proc.stdout || !proc.stderr || !proc.stdin) {
    throw new Error('python daemon stdio is not available')
  }

  proc.stdout.on('data', (d) => {
    daemonStdoutBuf += d.toString()
    while (true) {
      const idx = daemonStdoutBuf.indexOf('\n')
      if (idx === -1) break
      const line = daemonStdoutBuf.slice(0, idx).trim()
      daemonStdoutBuf = daemonStdoutBuf.slice(idx + 1)
      if (!line) continue

      let msg: DaemonResponse
      try {
        msg = JSON.parse(line) as DaemonResponse
      } catch {
        continue
      }

      const id = msg.id
      if (!id) continue
      const p = pending.get(id)
      if (!p) continue
      pending.delete(id)
      p.resolve(msg)
    }
  })

  proc.stderr.on('data', (d) => {
    // daemon自体のstderrは、個別のreq stderrとは別（必要なら後でログ転送する）
    void d
  })

  proc.on('close', (code) => {
    const err = new Error(`python daemon exited (code=${code})`)
    for (const [, p] of pending) p.reject(err)
    pending.clear()
    daemonProc = null
  })

  return daemonProc
}

function registerIpcHandlers() {
  ipcMain.handle('aegis:selectInputImage', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      ],
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('aegis:selectOutputPath', async (_event, args: { defaultName?: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: args?.defaultName,
      filters: [{ name: 'PNG', extensions: ['png'] }],
    })

    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle('aegis:showItemInFolder', async (_event, args: { filePath: string }) => {
    if (!args?.filePath) return false
    shell.showItemInFolder(args.filePath)
    return true
  })

  ipcMain.handle('aegis:openPath', async (_event, args: { path: string }) => {
    if (!args?.path) return { ok: false, error: 'path is required' }
    const res = await shell.openPath(args.path)
    if (res) return { ok: false, error: res }
    return { ok: true }
  })

  ipcMain.handle(
    'aegis:processImage',
    async (_event, args: { inputPath: string; outputPath: string; level: 1 | 2 | 3 }) => {
      const appRoot = process.env.APP_ROOT
      if (!appRoot) {
        throw new Error('APP_ROOT is not set')
      }

      const backendDir = path.join(appRoot, '..', 'backend')
      const scriptPath = path.join(backendDir, 'aegis_engine.py')
      const venvPython = path.join(backendDir, 'venv', 'bin', 'python')

      const pythonCmd = venvPython
      const proc = getDaemon(backendDir, scriptPath, pythonCmd)

      const id = randomUUID()
      const payload = {
        id,
        type: 'process',
        inputPath: args.inputPath,
        outputPath: args.outputPath,
        level: args.level,
      }

      const resp = await new Promise<DaemonResponse>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        if (!proc.stdin) {
          pending.delete(id)
          reject(new Error('python daemon stdin is not available'))
          return
        }
        proc.stdin.write(JSON.stringify(payload) + '\n')
      })

      if (!resp.ok) {
        throw new Error(resp.error || resp.traceback || 'daemon error')
      }

      return {
        stdout: resp.stdout ?? '',
        stderr: resp.stderr ?? '',
      }
    },
  )
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
app.whenReady().then(registerIpcHandlers)

app.on('before-quit', () => {
  if (daemonProc && !daemonProc.killed) {
    daemonProc.kill()
    daemonProc = null
  }
})
