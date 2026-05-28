/**
 * FolderCard.jsx
 * ──────────────
 * Grid card for displaying a single folder in the folder view.
 * Uses existing Tailwind dark-theme classes only.
 *
 * Props:
 *   folder    : { Id, FolderName, Icon, _hasDirectAccess }
 *   onClick   : (folder) => void
 */

import FolderIcon from './FolderIcon';

export default function FolderCard({ folder, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(folder)}
      className="
        flex flex-col items-center justify-center gap-2
        p-4 rounded-xl border border-slate-700
        bg-slate-800 hover:bg-slate-700 hover:border-accent-400
        transition-all duration-150 cursor-pointer text-center
        w-full
      "
    >
      <FolderIcon
        type="folder"
        customIcon={folder.Icon || null}
        className="text-2xl"
      />
      <span className="text-base text-slate-200 font-medium truncate w-full">
        {folder.FolderName}
      </span>
      {!folder._hasDirectAccess && (
        <span className="text-base text-slate-500" title="Navigation only">🔒</span>
      )}
    </button>
  );
}
