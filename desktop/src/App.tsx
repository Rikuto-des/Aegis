import React, { useEffect, useState } from 'react'

export default function App() {
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const handler = (_event: unknown, msg: unknown) => {
      setMessage(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }

    window.ipcRenderer.on('main-process-message', handler)
    return () => {
      window.ipcRenderer.off('main-process-message', handler)
    }
  }, [])

  return (
    <div>
      <h1>Aegis</h1>
      <div className="card">
        <p>main process message:</p>
        <code>{message || '(waiting...)'}</code>
      </div>
    </div>
  )
}
