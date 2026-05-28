/**
 * FileList.jsx
 * ────────────
 * Table view of files inside a folder.
 * Uses existing Tailwind dark-theme classes matching the system design.
 *
 * Props:
 *   files      : Array<{ Id, FileName, FileSize, FileExtension, MimeType, LastModified, FileUrl }>
 *   loading    : bool
 *   error      : string | null
 *   onOpenFile : (file) => void  — called when user clicks a file row
 */

import FolderIcon from './FolderIcon';

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function canPreview(file) {
  const ext = (file.FileExtension || '').toLowerCase();
  const mime = (file.MimeType || '').toLowerCase();
  return ext === 'pdf' || mime === 'application/pdf' ||
    mime.startsWith('video/') ||
    /^(mp4|webm|ogg|mov|avi|mkv|m4v|wmv|flv|3gp|3g2|ts|mpg|mpeg)$/.test(ext) ||
    /^(xlsx|xls|xlsm|xlsb|ods)$/.test(ext) ||
    mime.includes('spreadsheet') || mime === 'application/vnd.ms-excel';
}

export default function FileList({ files = [], loading, error, onOpenFile }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1,2,3].map(i => (
          <div key={i} className="skeleton h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error === 'access_denied') {
    return (
      <div className="text-center py-12 text-slate-500">
        <span className="text-4xl">🔒</span>
        <p className="mt-2">คุณไม่มีสิทธิ์เข้าถึงโฟลเดอร์นี้</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-400 text-base">{error}</p>;
  }

  if (!files.length) {
    return (
      <div className="text-center py-12 text-slate-500">
        <span className="text-4xl">📂</span>
        <p className="mt-2">ไม่มีไฟล์ในโฟลเดอร์นี้</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto panel">
      <table className="w-full text-base">
        <thead>
          <tr className="text-left text-steel-500 border-b border-slate-700/50">
            <th className="px-4 py-3 font-medium">ชื่อไฟล์</th>
            <th className="px-4 py-3 font-medium">ขนาด</th>
            <th className="px-4 py-3 font-medium">วันที่แก้ไข</th>
            <th className="px-4 py-3 font-medium text-right">เปิด</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {files.map(file => {
            const canPrev = canPreview(file);
            return (
              <tr key={file.Id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FolderIcon type="file" extension={file.FileExtension} />
                    <span className="text-brand-ink">{file.FileName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-steel-500 font-mono text-xs">
                  {formatSize(file.FileSize)}
                </td>
                <td className="px-4 py-3 text-steel-500 text-xs">
                  {formatDate(file.LastModified)}
                </td>
                <td className="px-4 py-3 text-right">
                  {onOpenFile && (
                    <button
                      onClick={() => onOpenFile(file)}
                      className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                        canPrev
                          ? 'bg-accent-500/15 text-accent-400 hover:bg-accent-500/25'
                          : 'text-steel-500 hover:text-steel-300'
                      }`}
                    >
                      {canPrev ? '▶ เปิด' : '↗ ดาวน์โหลด'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
