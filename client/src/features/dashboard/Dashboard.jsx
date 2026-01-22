import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import DataPicker from './DataPicker.jsx';
import ChartPanel from './ChartPanel.jsx';
import SingleValueCard from './SingleValueCard.jsx';
import { useSeriesFetcher } from './useSeriesFetcher.js';
import { apiGet, apiPost } from '../../lib/api';

function WidgetChrome({ title, children, onRemove, onRename }) {
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  return (
    <div className="border rounded-md bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        {editing ? (
          <input className="text-sm font-medium border rounded px-1" value={newTitle} onChange={e => setNewTitle(e.target.value)} onBlur={() => { onRename?.(newTitle); setEditing(false); }} onKeyDown={e => e.key === 'Enter' && (onRename?.(newTitle), setEditing(false))} autoFocus />
        ) : (
          <div className="font-medium text-sm cursor-pointer" onDoubleClick={() => setEditing(true)} title="Double-click to rename">{title}</div>
        )}
        {onRemove && (
          <button className="text-xs text-red-600" onClick={onRemove}>Remove</button>
        )}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const [pickerOpenFor, setPickerOpenFor] = useState(null); // {widgetId} or 'new-chart'/'new-single'
  const [savedDashboards, setSavedDashboards] = useState([]);
  const [activeDashboardId, setActiveDashboardId] = useState(null);
  const [dashboardName, setDashboardName] = useState('My Dashboard');
  const [widgets, setWidgets] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const importRef = useRef(null);

  // Load saved dashboards from server
  const loadDashboards = useCallback(async () => {
    try {
      const res = await apiGet('/dashboards');
      setSavedDashboards(res.dashboards || []);
    } catch {}
  }, []);

  useEffect(() => { loadDashboards(); }, [loadDashboards]);

  // Load a dashboard by id
  const loadDashboard = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiGet(`/dashboards/${id}`);
      const d = res.dashboard;
      setActiveDashboardId(d.id);
      setDashboardName(d.name || 'Dashboard');
      setWidgets(d.widgets || []);
      setDirty(false);
    } catch (e) { alert('Failed to load: ' + e.message); }
    finally { setLoading(false); }
  }, []);

  // Save current dashboard to server
  const saveDashboard = useCallback(async () => {
    setLoading(true);
    try {
      if (activeDashboardId) {
        await apiPost(`/dashboards/${activeDashboardId}`, { name: dashboardName, widgets }, 'PUT');
      } else {
        const res = await apiPost('/dashboards', { name: dashboardName, widgets });
        setActiveDashboardId(res.dashboard.id);
      }
      setDirty(false);
      await loadDashboards();
    } catch (e) { alert('Save failed: ' + e.message); }
    finally { setLoading(false); }
  }, [activeDashboardId, dashboardName, widgets, loadDashboards]);

  const newDashboard = () => { setActiveDashboardId(null); setDashboardName('New Dashboard'); setWidgets([]); setDirty(false); };

  const deleteDashboard = useCallback(async (id) => {
    if (!confirm('Delete this dashboard?')) return;
    try {
      await fetch(`/unicon/api/dashboards/${id}`, { method: 'DELETE' });
      if (activeDashboardId === id) newDashboard();
      await loadDashboards();
    } catch {}
  }, [activeDashboardId, loadDashboards]);

  // Export current dashboard JSON
  const exportDashboard = () => {
    const blob = new Blob([JSON.stringify({ name: dashboardName, widgets }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `dashboard-${dashboardName || 'export'}.json`; a.click(); URL.revokeObjectURL(url);
  };

  // Import dashboard JSON
  const importDashboard = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        const res = await apiPost('/dashboards/import', { dashboard: d });
        await loadDashboards();
        loadDashboard(res.dashboard.id);
      } catch (err) { alert('Import failed: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const save = (next) => { setWidgets(next); setDirty(true); };

  const addChart = () => setPickerOpenFor('new-chart');
  const addSingle = () => setPickerOpenFor('new-single');

  const onAddItem = (item) => {
    if (pickerOpenFor === 'new-chart') {
      const id = `chart-${Date.now()}`;
      save([...widgets, { id, type: 'chart', title: 'Chart', items: [item] }]);
    } else if (pickerOpenFor === 'new-single') {
      const id = `single-${Date.now()}`;
      save([...widgets, { id, type: 'single', title: item.label || 'Value', item }]);
    } else if (typeof pickerOpenFor === 'string') {
      save(widgets.map(w => w.id === pickerOpenFor ? { ...w, items: [...(w.items||[]), item] } : w));
    }
    setPickerOpenFor(null);
  };

  const removeWidget = (id) => save(widgets.filter(w => w.id !== id));
  const removeSeries = (wid, seriesId) => save(widgets.map(w => w.id === wid ? { ...w, items: (w.items||[]).filter(it => it.id !== seriesId) } : w));
  const renameWidget = (wid, newTitle) => save(widgets.map(w => w.id === wid ? { ...w, title: newTitle } : w));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input className="text-lg font-semibold border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none" value={dashboardName} onChange={e => { setDashboardName(e.target.value); setDirty(true); }} />
          {dirty && <span className="text-xs text-amber-600">unsaved</span>}
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 border rounded" onClick={addChart}>+ Chart</button>
          <button className="px-3 py-1.5 border rounded" onClick={addSingle}>+ Single value</button>
          <button className="px-3 py-1.5 border rounded bg-blue-600 text-white" onClick={saveDashboard} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          <button className="px-3 py-1.5 border rounded" onClick={newDashboard}>New</button>
          <button className="px-3 py-1.5 border rounded" onClick={exportDashboard}>Export</button>
          <button className="px-3 py-1.5 border rounded" onClick={() => importRef.current?.click()}>Import</button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={importDashboard} />
        </div>
      </div>

      {/* Saved dashboards list */}
      {savedDashboards.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-gray-500">Saved:</span>
          {savedDashboards.map(d => (
            <span key={d.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${d.id === activeDashboardId ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <button className="hover:underline" onClick={() => loadDashboard(d.id)}>{d.name}</button>
              <button className="text-red-500 text-xs" onClick={() => deleteDashboard(d.id)} title="Delete">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Widgets grid */}
      <div className="grid grid-cols-12 gap-4">
        {widgets.map(w => (
          <div key={w.id} className={w.type === 'single' ? 'col-span-3' : 'col-span-12'}>
            {w.type === 'chart' ? (
              <WidgetChrome title={w.title} onRemove={() => removeWidget(w.id)} onRename={(t) => renameWidget(w.id, t)}>
                <div className="mb-2 flex items-center gap-2 text-xs">
                  <button className="px-2 py-1 border rounded" onClick={() => setPickerOpenFor(w.id)}>Add series</button>
                </div>
                <ChartContent widget={w} onRemoveSeries={(sid) => removeSeries(w.id, sid)} />
              </WidgetChrome>
            ) : (
              <WidgetChrome title={w.title} onRemove={() => removeWidget(w.id)} onRename={(t) => renameWidget(w.id, t)}>
                <SingleContent widget={w} />
              </WidgetChrome>
            )}
          </div>
        ))}
        {widgets.length === 0 && (
          <div className="col-span-12 text-center text-gray-500 py-12">No widgets yet. Click "+ Chart" or "+ Single value" to add one.</div>
        )}
      </div>

      <DataPicker open={!!pickerOpenFor} onClose={() => setPickerOpenFor(null)} onAdd={onAddItem} />
    </div>
  );
}

function ChartContent({ widget, onRemoveSeries }) {
  const series = useSeriesFetcher(widget.items || [], 5000);
  return (
    <ChartPanel title={widget.title} series={series} onRemoveSeries={onRemoveSeries} />
  );
}

function SingleContent({ widget }) {
  const sArr = useSeriesFetcher([widget.item], 5000);
  const s = sArr?.[0];
  const latest = (s?.points || []).slice(-1)[0] || null;
  return (
    <SingleValueCard title={widget.title || s?.label || 'Value'} value={latest ? latest.value : '—'} unit={s?.unit} subtitle={latest ? new Date(latest.ts).toLocaleString() : ''} />
  );
}