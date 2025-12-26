import { useEffect, useState } from 'react'

export default function App() {
  const [message, setMessage] = useState<string>('')
  const [inputPath, setInputPath] = useState<string | null>(null)
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [level, setLevel] = useState<1 | 2 | 3>(2)
  const [running, setRunning] = useState(false)
  const [stdout, setStdout] = useState<string>('')
  const [stderr, setStderr] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const handler = (_event: unknown, msg: unknown) => {
      setMessage(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }

    window.ipcRenderer.on('main-process-message', handler)
    return () => {
      window.ipcRenderer.off('main-process-message', handler)
    }
  }, [])

  const onPickInput = async () => {
    setError('')
    const selected = await window.ipcRenderer.invoke('aegis:selectInputImage')
    if (typeof selected === 'string') setInputPath(selected)
  }

  const onPickOutput = async () => {
    setError('')
    const selected = await window.ipcRenderer.invoke('aegis:selectOutputPath', { defaultName: 'aegis_protected.png' })
    if (typeof selected === 'string') setOutputPath(selected)
  }

  const onRun = async () => {
    setError('')
    setStdout('')
    setStderr('')

    if (!inputPath) {
      setError('入力画像を選択してください')
      return
    }
    if (!outputPath) {
      setError('出力先を選択してください')
      return
    }

    setRunning(true)
    try {
      const result = await window.ipcRenderer.invoke('aegis:processImage', {
        inputPath,
        outputPath,
        level,
      })

      if (result && typeof result === 'object') {
        const r = result as { stdout?: string; stderr?: string }
        setStdout(r.stdout ?? '')
        setStderr(r.stderr ?? '')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <h1>Aegis</h1>
      <div className="card">
        <p>main process message:</p>
        <code>{message || '(waiting...)'}</code>
      </div>

      <div className="card" style={{ textAlign: 'left' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>入力画像</div>
            <button type="button" onClick={onPickInput} disabled={running}>
              選択
            </button>
            <div style={{ marginTop: 6, wordBreak: 'break-all', opacity: 0.9 }}>{inputPath ?? '(未選択)'}</div>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>出力先</div>
            <button type="button" onClick={onPickOutput} disabled={running}>
              選択
            </button>
            <div style={{ marginTop: 6, wordBreak: 'break-all', opacity: 0.9 }}>{outputPath ?? '(未選択)'}</div>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>防御レベル</div>
            <select
              value={level}
              onChange={(e) => setLevel(Number(e.target.value) as 1 | 2 | 3)}
              disabled={running}
            >
              <option value={1}>1: Stealth (メタデータ/LSBのみ)</option>
              <option value={2}>2: Shield (軽め)</option>
              <option value={3}>3: Nightshade (強め)</option>
            </select>
          </div>

          <div>
            <button type="button" onClick={onRun} disabled={running}>
              {running ? '処理中...' : '実行'}
            </button>
          </div>

          {error ? (
            <div style={{ color: '#ff6b6b', whiteSpace: 'pre-wrap' }}>{error}</div>
          ) : null}

          {stdout ? (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>stdout</div>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{stdout}</pre>
            </div>
          ) : null}

          {stderr ? (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>stderr</div>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{stderr}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
