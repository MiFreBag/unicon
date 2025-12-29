// client/src/workspaces/ftp/FtpWorkspace.jsx
import React, { useEffect, useState } from 'react'
import Button from '../../ui/Button.jsx'
import Input from '../../ui/Input.jsx'

export default function FtpWorkspace({ connection }) {
  const [cwd, setCwd] = useState('.')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  const API = '/unicon/api'

  async function list(dir = cwd) {
    if (!connection || connection.status !== 'connected') return
    setLoading(true)
    try {
      const res = await fetch(`${API}/operation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id, operation: 'list', params: { path: dir } })
      }).then(r=>r.json())
      if (res.success) { setItems(res.data || []); setCwd(dir) }
    } finally { setLoading(false) }
  }

  useEffect(()=>{ if (connection?.status==='connected') list('.') }, [connection?.status])

  function goUp() {
    if (!cwd || cwd === '.' || cwd === '/') { list('/') ; return }
    const up = cwd.replace(/\\+/g,'/').replace(/\/+/g,'/').split('/')
    up.pop(); const d = up.join('/') || '/'
    list(d)
  }

  function open(entry) {
    if (entry.isDirectory) {
      const next = (cwd === '/' ? `/${entry.name}` : `${cwd}/${entry.name}`)
      list(next)
    } else {
      setSelected(entry)
    }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    form.append('connectionId', connection.id)
    form.append('path', cwd)
    await fetch(`${API}/ftp/upload`, { method: 'POST', body: form })
    await list(cwd)
  }

  function onDownload() {
    if (!selected) return
    const url = `${API}/ftp/download?connectionId=${encodeURIComponent(connection.id)}&path=${encodeURIComponent((cwd==='/'?'' : cwd+'/'+selected.name))}`
    window.open(url, '_blank')
  }

  async function onDelete() {
    if (!selected) return
    const target = (cwd==='/'? '' : cwd + '/') + selected.name
    if (!confirm(`Delete ${target}?`)) return
    await fetch(`${API}/ftp/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ connectionId: connection.id, path: target }) })
    setSelected(null)
    await list(cwd)
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={goUp}>Up</Button>
        <Button variant="secondary" onClick={()=>list(cwd)}>Refresh</Button>
        <Input value={cwd} onChange={e=>setCwd(e.target.value)} className="flex-1" />
        <input type="file" onChange={onUpload} />
        <Button onClick={onDownload} disabled={!selected}>Download</Button>
        <Button variant="secondary" onClick={onDelete} disabled={!selected}>Delete</Button>
      </div>
      <div className="border rounded overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Size</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it,i)=> (
              <tr key={i} className={`border-b cursor-pointer ${selected?.name===it.name ? 'bg-blue-50' : ''}`} onClick={()=>open(it)}>
                <td className="px-3 py-2">{it.name}</td>
                <td className="px-3 py-2">{it.isDirectory ? 'dir' : 'file'}</td>
                <td className="px-3 py-2">{it.size ?? ''}</td>
              </tr>
            ))}
            {!items.length && (<tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>{loading ? 'Loading…' : 'Empty'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}