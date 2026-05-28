/**
 * FolderTree.jsx
 * ──────────────
 * Recursive sidebar tree component for the File Portal.
 * Mirrors the MenuLevel1/MenuLevel2 pattern from PublicLayout.jsx
 * using IDENTICAL CSS classes (nav-item, nav-item-active, text-accent-400, etc.)
 * so new portal sidebar blends perfectly with the existing navigation.
 *
 * Props:
 *   nodes        : Array<folder tree nodes with .children>
 *   selectedId   : number|null — currently active folder
 *   onSelect     : (folder) => void
 *
 * Behaviour:
 *   - Folders with _hasDirectAccess=false show a 🔒 prefix (navigation-only)
 *   - Clicking expands/collapses children (lazy — children already nested by API)
 *   - Active folder highlighted with nav-item-active class (existing CSS)
 */

import { useState } from 'react';
import FolderIcon from './FolderIcon';

function FolderNode({ node, selectedId, onSelect, depth = 0 }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children?.length > 0;
  const isActive    = node.Id === selectedId;

  const toggle = () => setOpen(o => !o);
  const select = () => {
    if (node._hasDirectAccess !== false) onSelect(node);
    else toggle();
  };

  return (
    <li className="list-none">
      <button
        type="button"
        onClick={select}
        className={`nav-item w-full flex items-center gap-2 ${isActive ? 'nav-item-active' : ''}`}
        style={{ paddingLeft: `${0.75 + depth * 1}rem` }}
        title={node._hasDirectAccess === false ? 'ไม่มีสิทธิ์โดยตรง (navigation เท่านั้น)' : undefined}
      >
        {/* Expand arrow */}
        <span className={`text-base text-slate-500 transition-transform ${open && hasChildren ? 'rotate-90' : ''}`}>
          {hasChildren ? '▶' : ' '}
        </span>

        <FolderIcon
          type="folder"
          customIcon={node.Icon || null}
          className="text-base shrink-0"
        />

        <span className="flex-1 text-left truncate text-base">
          {node.FolderName}
        </span>

        {node._hasDirectAccess === false && (
          <span className="text-slate-600 text-base">🔒</span>
        )}

        {hasChildren && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            className="text-slate-500 hover:text-slate-300 px-1"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? '−' : '+'}
          </button>
        )}
      </button>

      {open && hasChildren && (
        <ul className="mt-0.5">
          {node.children.map(child => (
            <FolderNode
              key={child.Id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function FolderTree({ nodes = [], selectedId, onSelect }) {
  if (!nodes.length) {
    return <p className="text-slate-500 text-base px-3 py-2">ไม่มีโฟลเดอร์</p>;
  }

  return (
    <ul className="space-y-0.5">
      {nodes.map(node => (
        <FolderNode
          key={node.Id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </ul>
  );
}
