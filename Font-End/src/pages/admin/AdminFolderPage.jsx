/**
 * AdminFolderPage.jsx  (Admin Portal — Folder Management)
 * ────────────────────
 * Route: /administrator/portal/folders
 *
 * แสดงโฟลเดอร์แบบ Tree/Group เพื่อให้จัดการ Folder และ Subfolder ได้ง่าย
 * รองรับ expand/collapse แต่ละกลุ่ม
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminGetFolders,
  adminDeleteFolder,
  adminUpdateFolder,
} from '../../services/portal.service';

// ── build tree ──────────────────────────────────────────────────
function buildTree(flatList) {
  const map = {};
  flatList.forEach(f => { map[f.Id] = { ...f, children: [] }; });
  const roots = [];
  flatList.forEach(f => {
    if (f.ParentId && map[f.ParentId]) {
      map[f.ParentId].children.push(map[f.Id]);
    } else {
      roots.push(map[f.Id]);
    }
  });
  // sort by SortOrder then name at each level
  const sort = nodes =>
    nodes
      .sort((a, b) => (a.SortOrder ?? 0) - (b.SortOrder ?? 0) || a.FolderName.localeCompare(b.FolderName))
      .map(n => ({ ...n, children: sort(n.children) }));
  return sort(roots);
}

// ── single folder row ───────────────────────────────────────────
function FolderRow({ folder, depth, expanded, onToggle, onVisibility, onDelete, navigate }) {
  const hasChildren = folder.children.length > 0;
  const isHidden    = !!folder.IsHidden;
  const indent      = depth * 20;

  return (
    <>
      <div
        className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors border mb-1
          ${isHidden
            ? 'bg-gray-50 border-gray-200 opacity-60'
            : depth === 0
              ? 'bg-white border-gray-200 shadow-sm'
              : 'bg-blue-50/40 border-blue-100'
          }`}
        style={{ marginLeft: indent }}
      >
        {/* expand/collapse toggle */}
        <button
          onClick={() => hasChildren && onToggle(folder.Id)}
          className={`w-5 h-5 flex items-center justify-center rounded text-gray-400 transition-transform shrink-0
            ${hasChildren ? 'hover:text-gray-700 cursor-pointer' : 'cursor-default opacity-0'}`}
          aria-label="toggle"
        >
          <span className={`inline-block transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </button>

        {/* folder icon + name */}
        <span className="text-base shrink-0">{folder.Icon || (depth === 0 ? '📁' : '📂')}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm truncate ${isHidden ? 'text-gray-400' : 'text-gray-800'}`}>
            {folder.FolderName}
            {hasChildren && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({folder.children.length})
              </span>
            )}
          </p>
          <p className="font-mono text-xs text-gray-400 truncate">{folder.FullPath}</p>
        </div>

        {/* visibility badge */}
        <button
          onClick={() => onVisibility(folder)}
          className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border transition-colors
            ${!isHidden
              ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
              : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
            }`}
        >
          {!isHidden ? 'Visible' : 'Hidden'}
        </button>

        {/* action buttons */}
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => navigate(`/administrator/portal/folders/new?parentId=${folder.Id}`)}
            title="เพิ่ม Subfolder"
            className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200"
          >
            + Sub
          </button>
          <button
            onClick={() => navigate(`/administrator/portal/permissions/${folder.Id}`)}
            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
          >
            สิทธิ์
          </button>
          <button
            onClick={() => navigate(`/administrator/portal/folders/${folder.Id}/edit`)}
            className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-300"
          >
            แก้ไข
          </button>
          <button
            onClick={() => onDelete(folder)}
            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
          >
            ลบ
          </button>
        </div>
      </div>

      {/* children */}
      {hasChildren && expanded && (
        <div>
          {folder.children.map(child => (
            <FolderRowWrapper
              key={child.Id}
              folder={child}
              depth={depth + 1}
              onVisibility={onVisibility}
              onDelete={onDelete}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </>
  );
}

// wrapper ที่มี local expand state ของแต่ละโหนด
function FolderRowWrapper({ folder, depth, onVisibility, onDelete, navigate }) {
  const [expanded, setExpanded] = useState(depth < 1); // root level เปิดโดยdefault

  return (
    <FolderRow
      folder={folder}
      depth={depth}
      expanded={expanded}
      onToggle={() => setExpanded(p => !p)}
      onVisibility={onVisibility}
      onDelete={onDelete}
      navigate={navigate}
    />
  );
}

// ── main page ───────────────────────────────────────────────────
export default function AdminFolderPage() {
  const navigate = useNavigate();
  const [tree,    setTree]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [confirm, setConfirm] = useState(null); // { id, name }
  const [search,  setSearch]  = useState('');

  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGetFolders();
      const list = data || [];
      setTotal(list.length);
      setTree(buildTree(list));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  const toggleVisibility = async (folder) => {
    try {
      await adminUpdateFolder(folder.Id, { IsHidden: !folder.IsHidden });
      await loadFolders();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await adminDeleteFolder(confirm.id);
      setConfirm(null);
      await loadFolders();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  // filter tree ตาม search keyword (แสดงทั้ง branch ที่ match)
  const filterTree = (nodes, kw) => {
    if (!kw) return nodes;
    const lower = kw.toLowerCase();
    return nodes.reduce((acc, node) => {
      const filteredChildren = filterTree(node.children, kw);
      const match = node.FolderName.toLowerCase().includes(lower) || node.FullPath.toLowerCase().includes(lower);
      if (match || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
      return acc;
    }, []);
  };

  const displayTree = filterTree(tree, search);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-display text-gray-800">จัดการโฟลเดอร์</h1>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">{total} โฟลเดอร์ทั้งหมด</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/administrator/portal/sync')}
            className="btn-primary text-sm px-3 py-1.5"
          >
            🔄 Sync Drive
          </button>
          <button
            onClick={() => navigate('/administrator/portal/folders/new')}
            className="btn-primary text-sm px-3 py-1.5"
          >
            + เพิ่มโฟลเดอร์
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="🔍  ค้นหาโฟลเดอร์..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
      </div>

      {loading && <div className="skeleton h-48 w-full rounded-xl" />}
      {error   && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 min-h-32">
          {displayTree.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">
              {search ? 'ไม่พบโฟลเดอร์ที่ค้นหา' : 'ยังไม่มีโฟลเดอร์'}
            </p>
          ) : (
            displayTree.map(node => (
              <FolderRowWrapper
                key={node.Id}
                folder={node}
                depth={0}
                onVisibility={toggleVisibility}
                onDelete={f => setConfirm({ id: f.Id, name: f.FolderName })}
                navigate={navigate}
              />
            ))
          )}
        </div>
      )}

      {/* Legend */}
      {!loading && !error && (
        <p className="text-xs text-gray-400 mt-3">
          💡 Hover บนโฟลเดอร์เพื่อแสดงปุ่มจัดการ · คลิก ▶ เพื่อ expand/collapse subfolder
        </p>
      )}

      {/* Delete confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 border border-gray-200 shadow-lg">
            <h3 className="text-gray-900 font-semibold mb-2">⚠️ ยืนยันการลบถาวร</h3>
            <p className="text-gray-700 text-sm mb-1">
              ต้องการลบ <span className="text-gray-900 font-semibold">"{confirm.name}"</span> ออกจากระบบ?
            </p>
            <p className="text-red-600 text-xs mb-4">
              ข้อมูลจะถูกลบถาวรออกจาก Database รวมถึงสิทธิ์และไฟล์ที่เชื่อมอยู่ทั้งหมด
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirm(null)} className="text-gray-500 text-sm hover:text-gray-800">
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                className="text-sm px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                ลบถาวร
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
