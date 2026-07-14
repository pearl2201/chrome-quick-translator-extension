import { useState, useRef, useEffect, useCallback } from 'react';
import { TranslatorEngine } from 'quick-translator-engine';

interface Props {
  /** Ref to the source textarea element */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export default function WordLookup({ textareaRef }: Props) {
  const [selectedText, setSelectedText] = useState('');
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleSelection = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const text = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim();
    if (!text || text.length === 0 || text.includes('\n')) {
      setVisible(false);
      return;
    }

    // Get cursor position relative to the textarea
    const rect = ta.getBoundingClientRect();
    const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 20;
    const lines = ta.value.substring(0, ta.selectionStart).split('\n');
    const col = lines[lines.length - 1].length;
    const row = lines.length - 1;

    // Approximate position
    const scrollTop = ta.scrollTop;
    const left = Math.min(col * 8.5, ta.clientWidth - 300) + rect.left;
    const top = (row + 1) * lineHeight - scrollTop + rect.top + 4;

    setPosition({ top, left });
    setSelectedText(text);

    // Look up in dictionaries; if not found, try translating
    try {
      const dictValue = TranslatorEngine.GetVietPhraseOrNameValueFromKey(text);
      if (dictValue) {
        setLookupResult(dictValue);
      } else {
        // Translate the selected text on the fly
        const translated = TranslatorEngine.ChineseToVietPhraseOneMeaning(text, 0, 0, true);
        setLookupResult(translated.result || '(no translation)');
      }
    } catch {
      setLookupResult('(lookup failed)');
    }

    setVisible(true);
    setEditMode(false);
  }, [textareaRef]);

  // Attach mouseup listener to the textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const onUp = () => setTimeout(handleSelection, 10);
    ta.addEventListener('mouseup', onUp);
    ta.addEventListener('keyup', onUp);
    return () => {
      ta.removeEventListener('mouseup', onUp);
      ta.removeEventListener('keyup', onUp);
    };
  }, [textareaRef, handleSelection]);

  // Hide on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [textareaRef]);

  /** Capitalize the first letter of each word (supports Vietnamese Unicode). */
  const toTitleCase = (s: string): string =>
    s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const handleAddName = () => {
    const raw = lookupResult && !lookupResult.startsWith('(') && !lookupResult.startsWith('(no')
      ? lookupResult
      : '';
    if (!raw || !selectedText) return;
    // Only the last line (after ===) — take the Việt phrase portion
    const viet = raw.includes('\n')
      ? raw.split('\n').filter(l => l && !l.startsWith('===')).pop()?.trim() || raw
      : raw;
    const titled = toTitleCase(viet);
    try {
      TranslatorEngine.UpdateNameDictionary(selectedText, titled, false, false);
    } catch {}
    chrome.storage.local.get('userDictionaryEntries', (res: { userDictionaryEntries?: Record<string, string> }) => {
      const entries: Record<string, string> = res.userDictionaryEntries || {};
      entries[selectedText] = titled;
      chrome.storage.local.set({ userDictionaryEntries: entries }, () => {
        setLookupResult(titled + ' ✅');
      });
    });
  };

  const handleEdit = () => {
    setEditValue(lookupResult && !lookupResult.startsWith('(') ? lookupResult : '');
    setEditMode(true);
  };

  const handleSave = () => {
    if (!editValue.trim() || !selectedText) return;
    const value = editValue.trim();

    // 1. Update the in-memory NamePhu dictionary (isNameChinh=false → Names2.txt)
    try {
      TranslatorEngine.UpdateNameDictionary(selectedText, value, false, false);
    } catch (e) {
      console.warn('In-memory update failed:', e);
    }

    // 2. Persist to chrome.storage.local so it survives reloads
    chrome.storage.local.get('userDictionaryEntries', (res: { userDictionaryEntries?: Record<string, string> }) => {
      const entries: Record<string, string> = res.userDictionaryEntries || {};
      entries[selectedText] = value;
      chrome.storage.local.set({ userDictionaryEntries: entries }, () => {
        setEditMode(false);
        setLookupResult(value + ' ✅');
      });
    });
  };

  if (!visible) return null;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 w-[320px] bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-white text-xs"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-850 rounded-t-lg">
        <span className="font-bold text-indigo-400 truncate max-w-[180px]">
          {selectedText}
        </span>
        <button
          onClick={() => setVisible(false)}
          className="text-slate-500 hover:text-slate-300 text-sm leading-none"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        {editMode ? (
          <div className="space-y-2">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">
              Vietnamese translation
            </label>
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold"
              >
                💾 Save
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-[11px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="font-mono text-slate-200 break-words min-h-[20px]">
              {lookupResult}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleAddName}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-semibold"
                title="Save with Title Case to Names2"
              >
                ➕ Add Name
              </button>
              <button
                onClick={handleEdit}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold"
              >
                ✏️ Edit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
