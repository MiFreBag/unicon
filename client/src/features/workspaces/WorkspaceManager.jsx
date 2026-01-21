// client/src/features/workspaces/WorkspaceManager.jsx
import React from 'react';
import Modal from '../../ui/Modal.jsx';
import { listWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace, listWorkspaceMembers, addWorkspaceMember, updateWorkspaceMember, removeWorkspaceMember, transferWorkspaceOwner } from '../../lib/api';

export default function WorkspaceManager({ open, onClose }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [editing, setEditing] = React.useState(null); // id
  const [editName, setEditName] = React.useState('');
  const [activeId, setActiveId] = React.useState(() => { try { return localStorage.getItem('unicon_current_workspace_v1') || ''; } catch { return ''; } });
  const [members, setMembers] = React.useState([]);
  const [membersSupported, setMembersSupported] = React.useState(true);
  const [inviteId, setInviteId] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('member');

  const load = async () => {
    setLoading(true);
    try { const d = await listWorkspaces(); setItems(d.workspaces || []); } finally { setLoading(false); }
  };
  React.useEffect(() => { if (open) load(); }, [open]);

  const loadMembers = async (id) => {
    if (!id) { setMembers([]); return; }
    try {
      const d = await listWorkspaceMembers(id);
      setMembers(d.members || []);
      setMembersSupported(true);
    } catch (e) {
      if (e && (e.status === 501 || String(e.message||'').includes('workspace_members_unsupported'))) {
        setMembersSupported(false);
        setMembers([]);
      } else {
        setMembers([]);
      }
    }
  };

  const setCurrent = (id) => {
    setActiveId(id || '');
    try { localStorage.setItem('unicon_current_workspace_v1', id || ''); } catch {}
    loadMembers(id);
  };

  React.useEffect(() => { if (open) loadMembers(activeId); }, [open]);

  const add = async () => {
    const name = newName.trim(); if (!name) return;
    const r = await createWorkspace(name);
    setItems(prev => [...prev, r.workspace]);
    setNewName('');
  };

  const startEdit = (w) => { setEditing(w.id); setEditName(w.name); };
  const saveEdit = async (w) => {
    const name = editName.trim(); if (!name) return;
    await updateWorkspace(w.id, name);
    setItems(prev => prev.map(x => x.id === w.id ? { ...x, name } : x));
    setEditing(null); setEditName('');
  };

  const del = async (w) => {
    if (!confirm(`Delete workspace "${w.name}"? Connections will be detached but not deleted.`)) return;
    await deleteWorkspace(w.id);
    setItems(prev => prev.filter(x => x.id !== w.id));
    if (activeId === w.id) setCurrent('');
  };

  return (
    <Modal open={open} title="Manage Workspaces" onClose={onClose} footer={(
      <>
        <button className="px-3 py-1.5 border rounded" onClick={onClose}>Close</button>
      </>
    )}>
      <div className="space-y-3">
        <div className="text-sm text-gray-600">{loading ? 'Loading…' : 'Create, rename, delete and select the active workspace.'}</div>
        <div className="flex gap-2">
          <input className="flex-1 border rounded px-2 py-1" placeholder="New workspace name" value={newName} onChange={e=>setNewName(e.target.value)} />
          <button className="px-3 py-1.5 border rounded" onClick={add}>Add</button>
        </div>
        <div className="border rounded divide-y">
          {items.map(w => (
            <div key={w.id} className="p-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input type="radio" name="active-ws" checked={activeId===w.id} onChange={()=>setCurrent(w.id)} />
                {editing===w.id ? (
                  <input className="border rounded px-2 py-1 text-sm" value={editName} onChange={e=>setEditName(e.target.value)} />
                ) : (
                  <div className="text-sm">{w.name}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editing===w.id ? (
                  <>
                    <button className="px-2 py-1 border rounded text-xs" onClick={()=>saveEdit(w)}>Save</button>
                    <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ setEditing(null); setEditName(''); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="px-2 py-1 border rounded text-xs" onClick={()=>startEdit(w)}>Rename</button>
                    <button className="px-2 py-1 border rounded text-xs text-red-600 hover:bg-red-50" onClick={()=>del(w)}>Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="p-3 text-sm text-gray-500">No workspaces yet.</div>
          )}
        </div>

        <div className="mt-4">
          <div className="font-semibold mb-1">Members {activeId ? '' : '(select a workspace)'}</div>
          {!membersSupported && (
            <div className="text-xs text-gray-600 border rounded p-2 bg-gray-50">Members are not available in this mode.</div>
          )}
          {membersSupported && activeId && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input className="flex-1 border rounded px-2 py-1" placeholder="User email or ID" value={inviteId} onChange={e=>setInviteId(e.target.value)} />
                <select className="border rounded px-2 py-1" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
                  <option value="viewer">viewer</option>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <button className="px-3 py-1.5 border rounded" onClick={async()=>{ if(!inviteId.trim()) return; try { await addWorkspaceMember(activeId, inviteId.trim(), inviteRole); setInviteId(''); const d = await listWorkspaceMembers(activeId); setMembers(d.members||[]); } catch(e){ alert('Add failed: '+(e.message||'error')); } }}>Add</button>
              </div>
              <div className="border rounded divide-y">
                {members.map(m => (
                  <div key={m.userId} className="p-2 flex items-center justify-between gap-2">
                    <div className="text-sm">{m.userId}</div>
                    <div className="flex items-center gap-2">
                      <select className="border rounded px-2 py-1 text-xs" value={m.role} onChange={async (e)=>{ try { await updateWorkspaceMember(activeId, m.userId, e.target.value); setMembers(prev => prev.map(x => x.userId===m.userId ? { ...x, role: e.target.value } : x)); } catch(err){ alert('Update failed: '+(err.message||'error')); } }}>
                        <option value="viewer">viewer</option>
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                      <button className="px-2 py-1 border rounded text-xs" onClick={async ()=>{ if(!confirm('Transfer ownership to this user?')) return; try { await transferWorkspaceOwner(activeId, m.userId); const d = await listWorkspaceMembers(activeId); setMembers(d.members||[]); alert('Ownership transferred.'); } catch(err){ alert('Transfer failed: '+(err.message||'error')); } }}>Make owner</button>
                      <button className="px-2 py-1 border rounded text-xs text-red-600 hover:bg-red-50" onClick={async ()=>{ if(!confirm('Remove member?')) return; try { await removeWorkspaceMember(activeId, m.userId); setMembers(prev => prev.filter(x => x.userId !== m.userId)); } catch(err){ alert('Remove failed: '+(err.message||'error')); } }}>Remove</button>
                    </div>
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="p-3 text-sm text-gray-500">No members yet.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}