/**
 * AdminFolderPage.jsx  (Admin Portal — Folder Management)
 * ────────────────────
 * Route: /administrator/portal/folders
 *
 * Folder tree for managing folders / subfolders.
 * - Expand state lives here (Set of ids) so it survives background reloads.
 * - Search keeps every matching branch (any depth) and auto-expands its ancestors.
 * - Visibility toggle is optimistic and reverts on error.
 * - FolderFormPage can pass `state.focusId` to scroll to / flash the saved folder.
 */

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { findIconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  adminGetFolders,
  adminDeleteFolder,
  adminUpdateFolder,
} from '../../services/portal.service';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Collapse from '../../components/ui/Collapse';
import { LoadingState, EmptyState, ErrorState, apiError } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';

// ── icon helpers ────────────────────────────────────────────────
// folder.Icon may be an FA class ("fa-solid fa-book") or the sync default
// text "folder" — only FA classes are honoured, everything else → folder icon.
const FA_STYLE = { 'fa-solid': 'fas', 'fa-regular': 'far', 'fa-brands': 'fab', fas: 'fas', far: 'far', fab: 'fab' };
function resolveFaIcon(value) {
  if (typeof value !== 'string' || !value.includes('fa-')) return null;
  const parts = value.trim().split(/\s+/);
  const style = parts.find(p => FA_STYLE[p]);
  const name  = parts.find(p => p.startsWith('fa-') && !FA_STYLE[p]);
  if (!name) return null;
  const def = findIconDefinition({ prefix: style ? FA_STYLE[style] : 'fas', iconName: name.slice(3) });
  return def ? [def.prefix, def.iconName] : null;
}

// Folder tint per depth (same order as the public sidebar tree)
const DEPTH_TINT = [
  'text-sky-600 bg-sky-50',
  'text-teal-600 bg-teal-50',
  'text-amber-600 bg-amber-50',
  'text-violet-600 bg-violet-50',
];
const tintFor = depth => DEPTH_TINT[Math.min(depth, DEPTH_TINT.length - 1)];

// Indent stops growing after this depth so deep trees fit on phones
const INDENT_CAP = 4;

// ── tree helpers ────────────────────────────────────────────────
const byOrder = (a, b) =>
  (a.SortOrder ?? 0) - (b.SortOrder ?? 0) || String(a.FolderName).localeCompare(String(b.FolderName), 'th');

function buildTree(flatList) {
  const map = new Map();
  flatList.forEach(f => map.set(f.Id, { ...f, children: [] }));
  const roots = [];
  map.forEach(node => {
    const parent = node.ParentId != null ? map.get(node.ParentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  const sort = nodes => {
    nodes.sort(byOrder);
    nodes.forEach(n => sort(n.children));
    return nodes;
  };
  return sort(roots);
}

// Keep matching nodes plus the ancestors leading to them (non-matching leaves are dropped).
function filterTree(nodes, kw) {
  return nodes.reduce((acc, node) => {
    const selfMatch =
      String(node.FolderName || '').toLowerCase().includes(kw) ||
      String(node.FullPath || '').toLowerCase().includes(kw);
    const kids = filterTree(node.children, kw);
    if (selfMatch || kids.length) acc.push({ ...node, children: kids, _match: selfMatch });
    return acc;
  }, []);
}

const isDeletedRow = f => f.IsActive === false || f.IsActive === 0;
const SHOW_DELETED_KEY = 'admin.folders.showDeleted';
const SHOW_HIDDEN_KEY  = 'admin.folders.showHidden';

// Drop folders deleted by sync / hidden (with their subtrees) unless the admin opted in.
// `keep` = ids that stay visible anyway (just hidden in this session, so the row doesn't vanish on click).
function pruneTree(nodes, { showDeleted, showHidden, keep }) {
  return nodes.reduce((acc, node) => {
    if (!keep.has(node.Id)) {
      if (!showDeleted && isDeletedRow(node)) return acc;
      if (!showHidden && node.IsHidden) return acc;
    }
    acc.push({ ...node, children: pruneTree(node.children, { showDeleted, showHidden, keep }) });
    return acc;
  }, []);
}

// Remembered per browser; storage may be blocked, so fall back to defaults.
function readFlag(key) {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}
function writeFlag(key, v) {
  try { localStorage.setItem(key, v ? '1' : '0') } catch { /* storage blocked */ }
}

// Where the admin was (open folders, search, scroll) — restored when coming back
// from add-subfolder / edit / permissions, for this tab only.
const VIEW_KEY = 'admin.folders.view';
function readView() {
  try { return JSON.parse(sessionStorage.getItem(VIEW_KEY) || 'null'); } catch { return null; }
}
function writeView(view) {
  try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch { /* storage blocked */ }
}

function descendantCount(flat, id) {
  const kids = new Map();
  flat.forEach(f => {
    if (f.ParentId == null) return;
    if (!kids.has(f.ParentId)) kids.set(f.ParentId, []);
    kids.get(f.ParentId).push(f.Id);
  });
  let count = 0;
  const stack = [...(kids.get(id) || [])];
  while (stack.length) {
    const cur = stack.pop();
    count += 1;
    stack.push(...(kids.get(cur) || []));
  }
  return count;
}

function ancestorIds(flat, id) {
  const byId = new Map(flat.map(f => [f.Id, f]));
  const out = [];
  let cur = byId.get(id);
  const seen = new Set();
  while (cur && cur.ParentId != null && !seen.has(cur.ParentId)) {
    seen.add(cur.ParentId);
    out.push(cur.ParentId);
    cur = byId.get(cur.ParentId);
  }
  return out;
}

// ── highlight ───────────────────────────────────────────────────
function Highlight({ text, kw }) {
  const str = String(text ?? '');
  if (!kw) return str;
  const idx = str.toLowerCase().indexOf(kw);
  if (idx < 0) return str;
  return (
    <>
      {str.slice(0, idx)}
      <mark className="bg-amber-200/80 text-slate-900 rounded px-0.5">{str.slice(idx, idx + kw.length)}</mark>
      {str.slice(idx + kw.length)}
    </>
  );
}

// ── single folder node ──────────────────────────────────────────
function FolderNode({ node, depth, ctx }) {
  const { kw, isExpanded, onToggle, onVisibility, onDelete, pending, focusId, navigate } = ctx;
  const hasChildren = node.children.length > 0;
  const expanded    = hasChildren && isExpanded(node.Id);
  const isHidden    = !!node.IsHidden;
  const isDeleted   = node.IsActive === false || node.IsActive === 0;
  const isPending   = pending.has(node.Id);
  const isFocus     = focusId === node.Id;
  const customIcon  = resolveFaIcon(node.Icon);
  const icon        = customIcon || ['fas', expanded ? 'folder-open' : 'folder'];
  const muted       = isHidden || isDeleted;

  return (
    <li>
      <div
        id={`folder-row-${node.Id}`}
        className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-1.5 sm:px-2 py-1.5 rounded-2xl transition-colors
          ${isDeleted ? 'bg-slate-50' : 'hover:bg-slate-50'}
          ${isFocus ? 'ring-2 ring-brand/30 bg-brand-soft/60' : ''}`}
      >
        {/* left: chevron + icon + name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node.Id)}
              className="btn-icon"
              aria-expanded={expanded}
              aria-label={expanded ? `ย่อ ${node.FolderName}` : `ขยาย ${node.FolderName}`}
              title={expanded ? 'ย่อ' : 'ขยาย'}
            >
              <FontAwesomeIcon
                icon={['fas', 'chevron-right']}
                className={`w-3 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}
              />
            </button>
          ) : (
            <span className="w-10 flex-shrink-0" aria-hidden="true" />
          )}

          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
              muted ? 'text-slate-400 bg-slate-100' : tintFor(depth)
            }`}
          >
            <FontAwesomeIcon icon={icon} />
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
              <span
                className={`text-base font-semibold truncate max-w-full ${
                  isDeleted ? 'text-slate-400 line-through decoration-slate-300' : isHidden ? 'text-slate-500' : 'text-slate-800'
                }`}
              >
                <Highlight text={node.FolderName} kw={kw} />
              </span>
              {hasChildren && (
                <span className="text-sm text-slate-400 flex-shrink-0">{node.children.length} รายการ</span>
              )}
              {isDeleted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
                  <FontAwesomeIcon icon={['fas', 'link-slash']} className="w-3" />
                  ถูกลบจาก Sync
                </span>
              )}
              {isHidden && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  <FontAwesomeIcon icon={['fas', 'eye-slash']} className="w-3" />
                  ซ่อนอยู่
                </span>
              )}
            </div>
            {node.FullPath && (
              <p className="font-mono text-sm text-slate-500 truncate" title={node.FullPath}>
                <Highlight text={node.FullPath} kw={kw} />
              </p>
            )}
          </div>
        </div>

        {/* right: actions (always visible) */}
        <div className="flex items-center justify-end gap-0.5 flex-shrink-0 pl-12 sm:pl-0">
          <button
            type="button"
            onClick={() => onVisibility(node)}
            disabled={isPending}
            className={`btn-icon ${isHidden ? 'text-slate-400' : 'text-emerald-600'}`}
            aria-pressed={!isHidden}
            aria-label={isHidden ? `แสดง ${node.FolderName} บนหน้าเว็บ` : `ซ่อน ${node.FolderName} จากหน้าเว็บ`}
            title={isHidden ? 'ซ่อนอยู่ — คลิกเพื่อแสดง' : 'แสดงอยู่ — คลิกเพื่อซ่อน'}
          >
            {isPending
              ? <FontAwesomeIcon icon={['fas', 'circle-notch']} spin />
              : <FontAwesomeIcon icon={['fas', isHidden ? 'eye-slash' : 'eye']} />}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/administrator/portal/folders/new?parentId=${node.Id}`)}
            className="btn-icon"
            aria-label={`เพิ่มโฟลเดอร์ย่อยใน ${node.FolderName}`}
            title="เพิ่มโฟลเดอร์ย่อย"
          >
            <FontAwesomeIcon icon={['fas', 'folder-plus']} />
          </button>
          <button
            type="button"
            onClick={() => navigate(`/administrator/portal/folders/${node.Id}/edit`)}
            className="btn-icon"
            aria-label={`แก้ไข ${node.FolderName}`}
            title="แก้ไข"
          >
            <FontAwesomeIcon icon={['fas', 'pen-to-square']} />
          </button>
          <button
            type="button"
            onClick={() => navigate(`/administrator/portal/permissions/${node.Id}`)}
            className="btn-icon"
            aria-label={`จัดการสิทธิ์ ${node.FolderName}`}
            title="จัดการสิทธิ์"
          >
            <FontAwesomeIcon icon={['fas', 'user-shield']} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            className="btn-icon btn-icon-danger"
            aria-label={`ลบ ${node.FolderName}`}
            title="ลบ"
          >
            <FontAwesomeIcon icon={['fas', 'trash-can']} />
          </button>
        </div>
      </div>

      {hasChildren && (
        <Collapse open={expanded}>
          {/* Guide line shows which folder the children belong to */}
          <ul
            className={`sb-stagger border-l-2 border-slate-100 py-0.5 ${
              depth < INDENT_CAP ? 'ml-5 pl-1.5 sm:ml-[21px] sm:pl-3' : 'ml-1 pl-1'
            }`}
          >
            {node.children.map(child => (
              <FolderNode key={child.Id} node={child} depth={depth + 1} ctx={ctx} />
            ))}
          </ul>
        </Collapse>
      )}
    </li>
  );
}

// ── main page ───────────────────────────────────────────────────
export default function AdminFolderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [folders,    setFolders]    = useState([]);
  const [loading,    setLoading]    = useState(true);   // first load only
  const [refreshing, setRefreshing] = useState(false);  // background reloads
  const [error,      setError]      = useState(null);
  const savedView = useRef(readView()).current;
  const [search,     setSearch]     = useState(() => savedView?.search || '');
  const [expandedIds, setExpandedIds] = useState(() => new Set(savedView?.expanded || []));
  const [searchCollapsed, setSearchCollapsed] = useState(() => new Set());
  const [pending,    setPending]    = useState(() => new Set());
  const [confirm,    setConfirm]    = useState(null);   // { id, name, descendants }
  const [deleting,   setDeleting]   = useState(false);
  const [focusId,    setFocusId]    = useState(() => location.state?.focusId ?? null);
  const [showDeleted, setShowDeletedState] = useState(() => readFlag(SHOW_DELETED_KEY));
  const [showHidden,  setShowHiddenState]  = useState(() => readFlag(SHOW_HIDDEN_KEY));
  const [keepVisible, setKeepVisible] = useState(() => new Set());
  const setShowDeleted = v => { writeFlag(SHOW_DELETED_KEY, v); setShowDeletedState(v); };
  const setShowHidden  = v => { writeFlag(SHOW_HIDDEN_KEY, v); setShowHiddenState(v); };

  const initialised = useRef(false);
  const reqSeq      = useRef(0);

  const loadFolders = useCallback(async ({ silent = false } = {}) => {
    const seq = ++reqSeq.current;
    if (silent) setRefreshing(true);
    else { setLoading(true); setError(null); }
    try {
      const list = (await adminGetFolders()) || [];
      if (seq !== reqSeq.current) return;
      setFolders(list);
      setError(null);
      // First load: open top-level folders so the structure is visible
      // (unless we're restoring the admin's previous view).
      if (!initialised.current) {
        initialised.current = true;
        if (savedView) return;
        const parents = new Set(list.filter(f => f.ParentId != null).map(f => f.ParentId));
        const open = new Set(list.filter(f => f.ParentId == null && parents.has(f.Id)).map(f => f.Id));
        setExpandedIds(open);
      }
    } catch (e) {
      if (seq !== reqSeq.current) return;
      if (silent) toast({ message: apiError(e, 'โหลดรายการโฟลเดอร์ใหม่ไม่สำเร็จ'), type: 'error' });
      else setError(apiError(e, 'โหลดรายการโฟลเดอร์ไม่สำเร็จ'));
    } finally {
      if (seq === reqSeq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [toast]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  // ── remember / restore the view ──
  // Depending on screen height the page scrolls either the window or
  // AdminLayout's <main>, so both positions are saved and restored.
  const rootRef    = useRef(null);
  const scrollPos  = useRef({ win: savedView?.win || 0, main: savedView?.main || 0 });
  const restored   = useRef(false);
  const expandedIdsRef = useRef(expandedIds);
  const searchRef      = useRef(search);
  expandedIdsRef.current = expandedIds;
  searchRef.current      = search;
  const saveView = useCallback(() => {
    writeView({
      expanded: [...expandedIdsRef.current],
      search: searchRef.current,
      win: scrollPos.current.win,
      main: scrollPos.current.main,
    });
  }, []);

  useEffect(() => { saveView(); }, [expandedIds, search, saveView]);

  // Layout effect: its cleanup runs synchronously on unmount, before the next
  // page's shorter content makes the browser clamp the scroll and fire an event
  // that would overwrite the saved position with ~0.
  useLayoutEffect(() => {
    const main = rootRef.current?.closest('main');
    let frame = 0;
    const onScroll = () => {
      if (!restored.current) return; // ignore the jump to top while the page is loading
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scrollPos.current = { win: window.scrollY, main: main?.scrollTop || 0 };
        saveView();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    main?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      main?.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [saveView]);

  // After the first load renders, jump back to the saved scroll position.
  // A folder just saved in the form (focusId) takes priority — it scrolls itself into view.
  useEffect(() => {
    if (loading || restored.current) return;
    const { win, main: mainTop } = scrollPos.current;
    if (focusId != null || (!win && !mainTop)) { restored.current = true; return; }
    const main = rootRef.current?.closest('main');
    // Two frames: let the restored tree lay out before scrolling.
    let f2;
    const f1 = requestAnimationFrame(() => {
      f2 = requestAnimationFrame(() => {
        if (main && mainTop) main.scrollTop = mainTop;
        if (win) window.scrollTo(0, win);
        restored.current = true;
      });
    });
    return () => { cancelAnimationFrame(f1); cancelAnimationFrame(f2); };
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Came back from the form: open the saved folder's ancestors, scroll to it, flash it.
  useEffect(() => {
    if (focusId == null || loading || !folders.length) return;
    if (!folders.some(f => f.Id === focusId)) return;
    const ups = ancestorIds(folders, focusId);
    if (ups.length) setExpandedIds(prev => new Set([...prev, ...ups]));
    const scrollT = setTimeout(() => {
      document.getElementById(`folder-row-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    const clearT = setTimeout(() => setFocusId(null), 2600);
    // Drop router state so a refresh does not flash again
    navigate(location.pathname, { replace: true, state: null });
    return () => { clearTimeout(scrollT); clearTimeout(clearT); };
  }, [focusId, loading, folders.length]);

  const tree = useMemo(() => buildTree(folders), [folders]);
  const kw   = search.trim().toLowerCase();
  const visibleTree = useMemo(
    () => pruneTree(tree, { showDeleted, showHidden, keep: keepVisible }),
    [tree, showDeleted, showHidden, keepVisible]
  );
  const displayTree = useMemo(() => (kw ? filterTree(visibleTree, kw) : visibleTree), [visibleTree, kw]);
  const matchCount  = useMemo(() => {
    if (!kw) return 0;
    const walk = nodes => nodes.reduce((n, x) => n + (x._match ? 1 : 0) + walk(x.children), 0);
    return walk(displayTree);
  }, [displayTree, kw]);

  const stats = useMemo(() => ({
    total:   folders.length,
    hidden:  folders.filter(f => f.IsHidden).length,
    deleted: folders.filter(f => f.IsActive === false || f.IsActive === 0).length,
  }), [folders]);

  // Reset per-search collapse overrides whenever the keyword changes
  useEffect(() => { setSearchCollapsed(new Set()); }, [kw]);

  // While searching every branch on screen is open unless the admin collapses it.
  const isExpanded = useCallback(
    id => (kw ? !searchCollapsed.has(id) : expandedIds.has(id)),
    [kw, searchCollapsed, expandedIds]
  );

  const toggleSet = (setter, id) => setter(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const onToggle = useCallback(id => {
    if (kw) toggleSet(setSearchCollapsed, id);
    else toggleSet(setExpandedIds, id);
  }, [kw]);

  const expandAll = () => {
    const parents = new Set(folders.filter(f => f.ParentId != null).map(f => f.ParentId));
    setExpandedIds(parents);
    setSearchCollapsed(new Set());
  };
  const collapseAll = () => {
    setExpandedIds(new Set());
    if (kw) setSearchCollapsed(new Set(folders.map(f => f.Id)));
  };

  // ── visibility (optimistic) ──
  const onVisibility = useCallback(async (folder) => {
    if (pending.has(folder.Id)) return;
    const nextHidden = !folder.IsHidden;
    setPending(prev => new Set(prev).add(folder.Id));
    // Keep a folder hidden from here on screen until reload, even with "show hidden" off
    if (nextHidden) setKeepVisible(prev => new Set(prev).add(folder.Id));
    setFolders(prev => prev.map(f => (f.Id === folder.Id ? { ...f, IsHidden: nextHidden } : f)));
    try {
      const res = await adminUpdateFolder(folder.Id, { IsHidden: nextHidden });
      const saved = res?.data;
      if (saved && saved.Id === folder.Id) {
        setFolders(prev => prev.map(f => (f.Id === folder.Id ? { ...f, ...saved } : f)));
      }
      toast({
        message: nextHidden ? `ซ่อน “${folder.FolderName}” แล้ว` : `แสดง “${folder.FolderName}” แล้ว`,
        type: 'success',
      });
    } catch (e) {
      setFolders(prev => prev.map(f => (f.Id === folder.Id ? { ...f, IsHidden: folder.IsHidden } : f)));
      toast({ message: apiError(e, 'เปลี่ยนการแสดงผลไม่สำเร็จ'), type: 'error' });
    } finally {
      setPending(prev => { const n = new Set(prev); n.delete(folder.Id); return n; });
    }
  }, [pending, toast]);

  const onDelete = useCallback(folder => {
    setConfirm({ id: folder.Id, name: folder.FolderName, descendants: descendantCount(folders, folder.Id) });
  }, [folders]);

  const handleDelete = async () => {
    if (!confirm || deleting) return;
    setDeleting(true);
    try {
      await adminDeleteFolder(confirm.id);
      toast({ message: `ลบ “${confirm.name}” แล้ว`, type: 'success' });
      setConfirm(null);
      await loadFolders({ silent: true });
    } catch (e) {
      toast({ message: apiError(e, 'ลบโฟลเดอร์ไม่สำเร็จ'), type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const ctx = { kw, isExpanded, onToggle, onVisibility, onDelete, pending, focusId, navigate };

  const subtitle = loading
    ? 'จัดโครงสร้างโฟลเดอร์ การแสดงผล และสิทธิ์การเข้าถึง'
    : [
        `${stats.total} โฟลเดอร์`,
        stats.hidden ? `ซ่อน ${stats.hidden}` : null,
        stats.deleted ? `ถูกลบจาก Sync ${stats.deleted}` : null,
      ].filter(Boolean).join(' · ');

  return (
    <div ref={rootRef}>
      <PageHeader
        icon="folder-tree"
        title="จัดการโฟลเดอร์"
        subtitle={subtitle}
        actions={
          <>
            <button
              type="button"
              onClick={() => loadFolders({ silent: true })}
              disabled={loading || refreshing}
              className="btn-secondary"
            >
              <FontAwesomeIcon icon={['fas', 'rotate-right']} spin={refreshing} />
              รีเฟรช
            </button>
            <button type="button" onClick={() => navigate('/administrator/portal/sync')} className="btn-secondary">
              <FontAwesomeIcon icon={['fas', 'arrows-rotate']} />
              Sync Drive
            </button>
            <button type="button" onClick={() => navigate('/administrator/portal/folders/new')} className="btn-primary">
              <FontAwesomeIcon icon={['fas', 'plus']} />
              เพิ่มโฟลเดอร์
            </button>
          </>
        }
      />

      {loading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => loadFolders()} />
      ) : folders.length === 0 ? (
        <EmptyState
          icon="folder-open"
          title="ยังไม่มีโฟลเดอร์"
          message="เริ่มจากการ Sync Drive เพื่อดึงโครงสร้างโฟลเดอร์ หรือเพิ่มโฟลเดอร์เอง"
          action={
            <button type="button" onClick={() => navigate('/administrator/portal/sync')} className="btn-primary">
              <FontAwesomeIcon icon={['fas', 'arrows-rotate']} />
              ไปหน้า Sync Drive
            </button>
          }
        />
      ) : (
        <div className="admin-card p-3 sm:p-4">
          {/* toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="relative flex-1 sm:max-w-md">
              <FontAwesomeIcon
                icon={['fas', 'magnifying-glass']}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อโฟลเดอร์หรือพาธ…"
                aria-label="ค้นหาโฟลเดอร์"
                className="input-field pl-11 pr-12"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="btn-icon absolute right-0.5 top-1/2 -translate-y-1/2"
                  aria-label="ล้างคำค้นหา"
                  title="ล้างคำค้นหา"
                >
                  <FontAwesomeIcon icon={['fas', 'xmark']} />
                </button>
              )}
            </div>
            {(stats.deleted > 0 || stats.hidden > 0) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {stats.deleted > 0 && (
                  <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer select-none text-base text-slate-600">
                    <input
                      type="checkbox"
                      checked={showDeleted}
                      onChange={e => setShowDeleted(e.target.checked)}
                      className="w-5 h-5 rounded accent-brand cursor-pointer"
                    />
                    แสดงที่ถูกลบจาก Sync <span className="text-slate-400">({stats.deleted})</span>
                  </label>
                )}
                {stats.hidden > 0 && (
                  <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer select-none text-base text-slate-600">
                    <input
                      type="checkbox"
                      checked={showHidden}
                      onChange={e => setShowHidden(e.target.checked)}
                      className="w-5 h-5 rounded accent-brand cursor-pointer"
                    />
                    แสดงที่ซ่อนอยู่ <span className="text-slate-400">({stats.hidden})</span>
                  </label>
                )}
              </div>
            )}
            <div className="flex items-center gap-1 sm:ml-auto">
              {kw && (
                <span className="text-sm text-slate-500 mr-2" aria-live="polite">
                  พบ {matchCount} รายการ
                </span>
              )}
              <button type="button" onClick={expandAll} className="btn-ghost">
                <FontAwesomeIcon icon={['fas', 'angles-down']} />
                ขยายทั้งหมด
              </button>
              <button type="button" onClick={collapseAll} className="btn-ghost">
                <FontAwesomeIcon icon={['fas', 'angles-up']} />
                ย่อทั้งหมด
              </button>
            </div>
          </div>

          {displayTree.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                <FontAwesomeIcon icon={['fas', 'magnifying-glass']} />
              </div>
              {kw ? (
                <>
                  <p className="text-base text-slate-600">ไม่พบโฟลเดอร์ที่ตรงกับ “{search.trim()}”</p>
                  <button type="button" onClick={() => setSearch('')} className="btn-ghost mt-2">
                    ล้างคำค้นหา
                  </button>
                </>
              ) : (
                <p className="text-base text-slate-600">ทุกโฟลเดอร์ถูกซ่อนหรือถูกลบจาก Sync — ติ๊กช่องด้านบนเพื่อแสดง</p>
              )}
            </div>
          ) : (
            <ul className="sb-stagger space-y-0.5" aria-label="โครงสร้างโฟลเดอร์">
              {displayTree.map(node => (
                <FolderNode key={node.Id} node={node} depth={0} ctx={ctx} />
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => { if (!deleting) setConfirm(null); }}
        onConfirm={handleDelete}
        loading={deleting}
        isDangerous
        title="ลบโฟลเดอร์ถาวร"
        confirmText="ลบถาวร"
        message={confirm && (
          <>
            <p>
              ต้องการลบ <strong className="text-slate-800">“{confirm.name}”</strong> ออกจากระบบใช่หรือไม่?
            </p>
            {confirm.descendants > 0 && (
              <p className="mt-2">
                โฟลเดอร์ย่อยอีก <strong className="text-slate-800">{confirm.descendants}</strong> รายการจะถูกลบไปด้วย
              </p>
            )}
            <p className="mt-2 text-red-600 text-sm">
              ข้อมูลโฟลเดอร์ สิทธิ์ และรายการไฟล์ที่เชื่อมอยู่จะถูกลบออกจากฐานข้อมูลถาวร
              ไฟล์จริงบนไดรฟ์จะไม่ถูกลบ — หากโฟลเดอร์ยังอยู่บนไดรฟ์ การ Sync ครั้งถัดไปจะดึงกลับมาใหม่โดยไม่มีสิทธิ์เดิม
            </p>
          </>
        )}
      />
    </div>
  );
}
