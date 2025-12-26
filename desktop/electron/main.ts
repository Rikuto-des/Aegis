import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawn } from 'node:child_process'

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
      const cliArgs = [
        scriptPath,
        '--input',
        args.inputPath,
        '--output',
        args.outputPath,
        '--level',
        String(args.level),
        '--mode',
        'full',
      ]

      return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(pythonCmd, cliArgs, {
          cwd: backendDir,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (d) => {
          stdout += d.toString()
        })
        child.stderr.on('data', (d) => {
          stderr += d.toString()
        })

        child.on('error', (err) => reject(err))
        child.on('close', (code) => {
          if (code === 0) {
            resolve({ stdout, stderr })
          } else {
            reject(new Error(`aegis_engine.py failed (code=${code})\n${stderr || stdout}`))
          }
        })
      })
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
