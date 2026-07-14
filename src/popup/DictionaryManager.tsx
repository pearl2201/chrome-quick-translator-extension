import { useState, useEffect } from 'react';
import { TranslatorEngine } from 'quick-translator-engine';

type SortField = 'key' | 'value';
type SortDir = 'asc' | 'desc';

interface Entry {
  key: string;
  value: string;
}

export default function DictionaryManager() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // Load entries from storage
  const loadEntries = () => {
    chrome.storage.local.get('userDictionaryEntries', (res: { userDictionaryEntries?: Record<string, string> }) => {
      const data = res.userDictionaryEntries || {};
      const list: Entry[] = Object.entries(data).map(([key, value]) => ({ key, value }));
      setEntries(list);
    });
  };

  useEffect(() => { loadEntries(); }, []);

  // Filter & sort
  const filtered = entries
    .filter((e) => e.key.includes(search) || e.value.includes(search))
    .sort((a, b) => {
      const cmp = a[sortField].localeCompare(b[sortField]);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Save edited entry
  const handleUpdate = (key: string) => {
    if (!editValue.trim()) return;
    chrome.storage.local.get('userDictionaryEntries', (res: { userDictionaryEntries?: Record<string, string> }) => {
      const entries = res.userDictionaryEntries || {};
      entries[key] = editValue.trim();
      chrome.storage.local.set({ userDictionaryEntries: entries }, () => {
        // Also update in-memory dictionary
        try { TranslatorEngine.UpdateNameDictionary(key, editValue.trim(), false, false); } catch {}
        setEditingKey(null);
        loadEntries();
      });
    });
  };

  // Delete entry
  const handleDelete = (key: string) => {
    chrome.storage.local.get('userDictionaryEntries', (res: { userDictionaryEntries?: Record<string, string> }) => {
      const entries = res.userDictionaryEntries || {};
      delete entries[key];
      chrome.storage.local.set({ userDictionaryEntries: entries }, () => {
        loadEntries();
      });
    });
  };

  // Add new entry
  const handleAdd = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    chrome.storage.local.get('userDictionaryEntries', (res: { userDictionaryEntries?: Record<string, string> }) => {
      const entries = res.userDictionaryEntries || {};
      entries[newKey.trim()] = newValue.trim();
      chrome.storage.local.set({ userDictionaryEntries: entries }, () => {
        // Update in-memory dictionary
        try { TranslatorEngine.UpdateNameDictionary(newKey.trim(), newValue.trim(), false, false); } catch {}
        setNewKey('');
        setNewValue('');
        loadEntries();
      });
    });
  };

  // Export as Names2.txt format
  const handleExport = () => {
    if (!entries.length) return;
    const lines = entries.map((e) => `${e.key}=${e.value}`);
    const content = lines.join('\r\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Names2_custom.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import from Names2.txt format
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.u8';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      chrome.storage.local.get('userDictionaryEntries', (res: { userDictionaryEntries?: Record<string, string> }) => {
        const entries = res.userDictionaryEntries || {};
        for (const line of text.split(/\r?\n/)) {
          const eq = line.indexOf('=');
          if (eq > 0) {
            const k = line.slice(0, eq).trim();
            const v = line.slice(eq + 1).trim();
            if (k && v) {
              entries[k] = v;
              try { TranslatorEngine.UpdateNameDictionary(k, v, false, false); } catch {}
            }
          }
        }
        chrome.storage.local.set({ userDictionaryEntries: entries }, () => loadEntries());
      });
    };
    input.click();
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 text-indigo-400">
      {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '▽'}
    </span>
  );

  return (
    <div className="h-screen w-screen bg-slate-900 text-white flex flex-col overflow-hidden selection:bg-indigo-500">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0 bg-slate-950">
        <h1 className="text-lg font-bold tracking-tight text-indigo-400">
          Dictionary Manager — Quick Translator JS
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{entries.length} entries</span>
          <button onClick={handleImport} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition">
            📥 Import
          </button>
          <button onClick={handleExport} className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded-lg transition">
            📤 Export
          </button>
          <button onClick={loadEntries} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition">
            🔄 Refresh
          </button>
        </div>
      </nav>

      {/* Add new entry */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 bg-slate-950/50">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Chinese</label>
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. 中文测试" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Vietnamese</label>
            <input value={newValue} onChange={(e) => setNewValue(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. Trung văn trắc nghiệm" />
          </div>
          <button onClick={handleAdd}
            className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shrink-0">
            ＋ Add
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="shrink-0 px-4 py-2 border-b border-slate-800">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
          placeholder="🔍 Search entries…" />
      </div>

      {/* Table */}
      <main className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-800 text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2 cursor-pointer hover:text-white w-1/2" onClick={() => toggleSort('key')}>
                Chinese <SortIcon field="key" />
              </th>
              <th className="text-left px-4 py-2 cursor-pointer hover:text-white w-1/2" onClick={() => toggleSort('value')}>
                Vietnamese <SortIcon field="value" />
              </th>
              <th className="text-right px-4 py-2 w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={3} className="text-center py-10 text-slate-600">No entries found.</td></tr>
            )}
            {filtered.map((entry) => (
              <tr key={entry.key} className="border-t border-slate-800 hover:bg-slate-800/50">
                <td className="px-4 py-2 font-mono text-indigo-300 break-all">{entry.key}</td>
                <td className="px-4 py-2 font-mono text-slate-200 break-all">
                  {editingKey === entry.key ? (
                    <div className="flex gap-1">
                      <input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                        autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdate(entry.key)} />
                      <button onClick={() => handleUpdate(entry.key)} className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px]">Save</button>
                      <button onClick={() => setEditingKey(null)} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-[10px]">✕</button>
                    </div>
                  ) : (
                    entry.value
                  )}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => { setEditingKey(entry.key); setEditValue(entry.value); }}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[10px] mr-1">✏️</button>
                  <button onClick={() => handleDelete(entry.key)}
                    className="px-2 py-1 bg-red-900 hover:bg-red-800 text-red-300 rounded text-[10px]">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
