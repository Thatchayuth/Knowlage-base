/**
 * FolderIcon.jsx
 * ──────────────
 * Renders an appropriate icon for a file based on its extension,
 * or a folder icon for folder entries. Uses existing Tailwind classes only.
 *
 * Props:
 *   type         : 'folder' | 'file'
 *   extension    : string (e.g. 'pdf', 'xlsx', 'docx') — for files
 *   customIcon   : string (optional emoji or icon class override)
 *   className    : string (additional Tailwind classes)
 */

const EXT_MAP = {
  pdf:  { icon: '📄', color: 'text-red-400' },
  docx: { icon: '📝', color: 'text-blue-400' },
  doc:  { icon: '📝', color: 'text-blue-400' },
  xlsx: { icon: '📊', color: 'text-green-400' },
  xls:  { icon: '📊', color: 'text-green-400' },
  pptx: { icon: '📋', color: 'text-orange-400' },
  ppt:  { icon: '📋', color: 'text-orange-400' },
  txt:  { icon: '📃', color: 'text-slate-300' },
  csv:  { icon: '🗃️', color: 'text-green-300' },
  zip:  { icon: '🗜️', color: 'text-yellow-400' },
  rar:  { icon: '🗜️', color: 'text-yellow-400' },
  jpg:  { icon: '🖼️', color: 'text-pink-400' },
  jpeg: { icon: '🖼️', color: 'text-pink-400' },
  png:  { icon: '🖼️', color: 'text-pink-400' },
  gif:  { icon: '🖼️', color: 'text-pink-400' },
  mp4:  { icon: '🎬', color: 'text-purple-400' },
  mp3:  { icon: '🎵', color: 'text-purple-300' },
};

export default function FolderIcon({ type = 'folder', extension = '', customIcon, className = '' }) {
  if (customIcon) {
    return <span className={`text-lg ${className}`}>{customIcon}</span>;
  }

  if (type === 'folder') {
    return <span className={`text-lg text-accent-400 ${className}`}>📁</span>;
  }

  const ext  = extension?.toLowerCase() || '';
  const meta = EXT_MAP[ext] || { icon: '📄', color: 'text-slate-400' };
  return <span className={`text-lg ${meta.color} ${className}`}>{meta.icon}</span>;
}
