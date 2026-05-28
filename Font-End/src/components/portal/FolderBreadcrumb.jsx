/**
 * FolderBreadcrumb.jsx
 * ────────────────────
 * Renders a breadcrumb trail for the current folder path.
 * Uses existing text/color CSS classes (text-slate-400, text-accent-400).
 *
 * Props:
 *   items : Array<{ id:number|null, label:string }>
 *           First item is always { id:null, label:'Portal' } (root)
 *   onNavigate(id) : called when a breadcrumb item is clicked
 *
 * Example:
 *   Portal › HR › Salary › 2025
 */

import { Link } from 'react-router-dom';

export default function FolderBreadcrumb({ items = [], onNavigate }) {
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-base text-slate-400 mb-4 flex-wrap">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.id}-${idx}`} className="flex items-center gap-1">
            {isLast ? (
              <span className="text-accent-400 font-medium">{item.label}</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  className="hover:text-accent-400 transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
                <span className="text-slate-600">›</span>
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}
