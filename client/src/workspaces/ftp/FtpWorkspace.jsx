  function toggleSelect(name, only=false) {
    setSelectedNames(prev => {
      const next = only ? new Set() : new Set(prev)
      if (only) next.add(name)
      else if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  async function onMkdir() {
    const folder = prompt('New folder name:')
    if (!folder) return
    await fetch(`${API}/operation`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ connectionId: connection.id, operation: 'mkdir', params: { path: (cwd==='/'? '' : cwd + '/') + folder }}) })
    await list(cwd)
  }

  async function onRename() {
    const names = Array.from(selectedNames)
    if (names.length !== 1) return
    const oldName = names[0]
    const to = prompt('Rename to:', oldName)
    if (!to || to === oldName) return
    await fetch(`${API}/operation`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ connectionId: connection.id, operation: 'rename', params: { from: (cwd==='/'? '' : cwd + '/') + oldName, to: (cwd==='/'? '' : cwd + '/') + to } }) })
    await list(cwd)
  }

  async function onOpenEditor() {
    const names = Array.from(selectedNames)
    if (names.length !== 1) return
    const path = (cwd==='/'? '' : cwd + '/') + names[0]
    const res = await fetch(`${API}/${proto}/text?connectionId=${encodeURIComponent(connection.id)}&path=${encodeURIComponent(path)}`).then(r=>r.json())
    if (!res.success) { alert(res.error || 'Failed to load file'); return }
    if (res.size > 256*1024) { alert('File too large for inline editor (>256KB)') ; return }
    setEditor({ open: true, path, content: res.content || '', saving: false })
  }

  async function saveEditor() {
    setEditor(p => ({ ...p, saving: true }))
    const resp = await fetch(`${API}/${proto}/text`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ connectionId: connection.id, path: editor.path, content: editor.content }) }).then(r=>r.json())
    setEditor(p => ({ ...p, saving: false }))
    if (!resp.success) { alert(resp.error || 'Save failed'); return }
    setEditor({ open:false, path:'', content:'', saving:false })
    await list(cwd)
  }

  function onDragOver(e){ e.preventDefault(); }
  async function onDrop(e){
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files || [])
    if (!files.length) return
    for (const f of files) {
      const form = new FormData()
      form.append('file', f)
      form.append('connectionId', connection.id)
      form.append('path', cwd)
      await fetch(`${API}/${proto}/upload`, { method: 'POST', body: form })
    }
    await list(cwd)
  }

// client/src/workspaces/ftp/FtpWorkspace.jsx
import React, { useEffect, useState } from 'react'
import Button from '../../ui/Button.jsx'
import Input from '../../ui/Input.jsx'
import Modal from '../../ui/Modal.jsx'
import { createConnection } from '../../lib/api'

export default function FtpWorkspace({ connection, protocol: protocolProp, openTab }) {
  const [cwd, setCwd] = useState('.')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedNames, setSelectedNames] = useState(new Set())
  const [editor, setEditor] = useState({ open: false, path: '', content: '', saving: false })

  const API = '/unicon/api'
  const proto = (protocolProp || (connection?.type === 'sftp' ? 'sftp' : 'ftp'))

  async function list(dir = cwd) {
    if (!connection || connection.status !== 'connected') return
    setLoading(true)
    try {
      const res = await fetch(`${API}/operation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id, operation: 'list', params: { path: dir } })
      }).then(r=>r.json())
      if (res.success) { setItems(res.data || []); setCwd(dir); setSelectedNames(new Set()) }
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
    const isDir = entry.isDirectory === true || entry.type === 1 || entry.type === 'd'
    if (isDir) {
      const next = (cwd === '/' ? `/${entry.name}` : `${cwd}/${entry.name}`)
      list(next)
    } else {
      toggleSelect(entry.name, true)
    }
  }

  async function onUpload(e) {
    const files = e?.target?.files ? Array.from(e.target.files) : []
    if (!files.length) return
    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      form.append('connectionId', connection.id)
      form.append('path', cwd)
      await fetch(`${API}/${proto}/upload`, { method: 'POST', body: form })
    }
    await list(cwd)
  }

  function onDownload() {
    const names = Array.from(selectedNames)
    if (!names.length) return
    for (const name of names) {
      const url = `${API}/${proto}/download?connectionId=${encodeURIComponent(connection.id)}&path=${encodeURIComponent((cwd==='/'?'' : cwd+'/'+name))}`
      window.open(url, '_blank')
    }
  }

  async function onDelete() {
    const names = Array.from(selectedNames)
    if (!names.length) return
    if (!confirm(`Delete ${names.length} item(s)?`)) return
    for (const name of names) {
      const target = (cwd==='/'? '' : cwd + '/') + name
      await fetch(`${API}/${proto}/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ connectionId: connection.id, path: target }) })
    }
    await list(cwd)
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-700">
          Quick pick:
          <select className="ml-2 border rounded px-2 py-1" onChange={async (e)=>{
            const v = e.target.value; e.target.value=''; if (!v) return;
            if (v==='ftp_local') {
              const res = await createConnection({ name: 'FTP localhost', type: 'ftp', config: { host:'localhost', port:21, secure:false } });
              const conn = res.connection; if (typeof openTab==='function') openTab('ftp', { connectionId: conn.id, connection: conn, title: `FTP • ${conn.name}` });
            } else if (v==='sftp_local') {
              const res = await createConnection({ name: 'SFTP localhost', type: 'sftp', config: { host:'localhost', port:22, username:'user' } });
              const conn = res.connection; if (typeof openTab==='function') openTab('sftp', { connectionId: conn.id, connection: conn, title: `SFTP • ${conn.name}` });
            }
          }}>
            <option>Pick…</option>
            <option value="ftp_local">FTP localhost (21)</option>
            <option value="sftp_local">SFTP localhost (22)</option>
          </select>
        </div>
        <Button variant="secondary" onClick={goUp}>Up</Button>
        <Button variant="secondary" onClick={()=>list(cwd)}>Refresh</Button>
        <Input value={cwd} onChange={e=>setCwd(e.target.value)} className="flex-1" />
        <input type="file" multiple onChange={onUpload} />
        <Button onClick={onDownload} disabled={!selectedNames.size}>Download</Button>
        <Button variant="secondary" onClick={onDelete} disabled={!selectedNames.size}>Delete</Button>
        <Button variant="secondary" onClick={onMkdir}>Mkdir</Button>
        <Button variant="secondary" onClick={onRename} disabled={selectedNames.size!==1}>Rename</Button>
        <Button variant="secondary" onClick={onOpenEditor} disabled={selectedNames.size!==1}>Edit</Button>
      </div>
      <div className="border rounded overflow-auto" onDragOver={onDragOver} onDrop={onDrop}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-3 py-2"><input type="checkbox" aria-label="Select all" onChange={e=>{
                if (e.target.checked) setSelectedNames(new Set(items.filter(it=>!(it.isDirectory===true || it.type===1 || it.type==='d')).map(it=>it.name)))
                else setSelectedNames(new Set())
              }} /></th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Size</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it,i)=> {
              const isDir = (it.isDirectory === true || it.type === 1 || it.type === 'd')
              const checked = selectedNames.has(it.name)
              return (
                <tr key={i} className={`border-b ${checked ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2 align-middle">
                    {!isDir && (<input type="checkbox" checked={checked} onChange={()=>toggleSelect(it.name)} />)}
                  </td>
                  <td className="px-3 py-2">
                    <button className="hover:underline" onClick={()=>open(it)}>{it.name}</button>
                  </td>
                  <td className="px-3 py-2">{isDir ? 'dir' : 'file'}</td>
                  <td className="px-3 py-2">{it.size ?? ''}</td>
                </tr>
              )})}
            {!items.length && (<tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>{loading ? 'Loading…' : 'Empty'}</td></tr>)}
          </tbody>
        </table>
      </div>

      <Modal open={editor.open} title={`Edit ${editor.path}`} onClose={()=> setEditor({ open:false, path:'', content:'', saving:false })}
        footer={<>
          <Button variant="secondary" onClick={()=> setEditor({ open:false, path:'', content:'', saving:false })}>Cancel</Button>
          <Button onClick={saveEditor} disabled={editor.saving}>{editor.saving ? 'Saving…' : 'Save'}</Button>
        </>}
      >
        <textarea className="w-full h-80 border rounded p-2 font-mono text-sm" value={editor.content} onChange={e=> setEditor(p=> ({...p, content: e.target.value}))} />
      </Modal>
    </div>
  )
}
