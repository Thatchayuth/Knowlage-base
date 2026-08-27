/**
 * FolderViewPage.jsx
 * ──────────────────
 * Shows contents (subfolders + files) for a specific folder.
 * Route: /portal/:id
 *
 * Renders inside existing PublicLayout (same sidebar as IFAQ).
 * PDF and video files open with the same viewer as KnowledgePage.
 */

import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState }          from 'react';
import PublicLayout                     from '../layouts/PublicLayout';
import { useFolderTree }                from '../hooks/useFolderTree';
import { useFolderFiles }               from '../hooks/useFolderFiles';
import { getFolderChildren }            from '../services/portal.service';
import FolderCard                       from '../components/portal/FolderCard';
import FileList                         from '../components/portal/FileList';
import { getApiBaseUrl }                from '../services/axios';
import Spinner                          from '../components/ui/Spinner';

// ── helpers ──────────────────────────────────────────────────

function isPdf(file) {
  return /\.pdf$/i.test(file.FileName) || file.MimeType === 'application/pdf';
}

function isVideo(file) {
  return /\.(mp4|webm|ogg|mov|avi|mkv|m4v|wmv|flv|3gp|3g2|ts|mpg|mpeg)$/i.test(file.FileName) ||
    (file.MimeType || '').startsWith('video/');
}

function isExcel(file) {
  return /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(file.FileName) ||
    (file.MimeType || '').includes('spreadsheet') ||
    file.MimeType === 'application/vnd.ms-excel';
}

function resolveVideoEmbed(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return { type: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
  // blob URLs and direct video file URLs → use <video> tag
  if (url.startsWith('blob:') || /\.(mp4|webm|ogg|mov|mkv|m4v|avi|wmv|flv|3gp)(\?|$)/i.test(url))
    return { type: 'video', src: url };
  return { type: 'iframe', src: url };
}

// ── Component ─────────────────────────────────────────────────

export default function FolderViewPage() {
  const { id }   = useParams();
  const folderId = parseInt(id, 10);
  const navigate = useNavigate();

  const { tree }                                    = useFolderTree();
  const { files, loading: filesLoading, error: filesError } = useFolderFiles(folderId);

  const [children,   setChildren]   = useState([]);
  const [childLoad,  setChildLoad]  = useState(false);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, label: 'Portal' }]);
  const [viewing,    setViewing]    = useState(null); // { file, type: 'pdf'|'video'|'excel', url?, sheets?, activeSheet? }
  const [iframeLoading, setIframeLoading] = useState(true);

  // Load children
  useEffect(() => {
    setChildLoad(true);
    setViewing(null);
    getFolderChildren(folderId)
      .then(data => setChildren(data || []))
      .catch(() => setChildren([]))
      .finally(() => setChildLoad(false));
  }, [folderId]);

  // Build breadcrumb from tree
  useEffect(() => {
    if (!tree.length) return;
    const crumbs = [{ id: null, label: 'Portal' }];
    function findPath(nodes, targetId) {
      for (const n of nodes) {
        if (n.Id === targetId) { crumbs.push({ id: n.Id, label: n.FolderName }); return true; }
        if (n.children?.length && findPath(n.children, targetId)) {
          crumbs.splice(1, 0, { id: n.Id, label: n.FolderName }); return true;
        }
      }
      return false;
    }
    findPath(tree, folderId);
    setBreadcrumb(crumbs);
  }, [tree, folderId]);

  const credentials = sessionStorage.getItem('km_credentials');
  const fileIdForViewing = viewing?.file?.Id;
  const newTabUrl = credentials && fileIdForViewing
    ? `${getApiBaseUrl()}/api/portal/files/${fileIdForViewing}?auth=${encodeURIComponent(credentials)}`
    : viewing?.url;

  const handleSelectFolder = (folder) => navigate(`/portal/${folder.Id}`);

  const handleOpenFile = (file) => {
    // Build full backend URL (works in both dev and prod)
    const apiBase = getApiBaseUrl();
    const fileUrl = `${apiBase}/api/portal/files/${file.Id}`;

    // Attach credentials header — iframe/anchor can't send headers,
    // so we embed credentials in the URL via a temporary object URL isn't possible.
    // Instead, use axios to fetch and create a blob URL for preview.
    const credentials = sessionStorage.getItem('km_credentials');
    const headers = credentials ? { Authorization: `Basic ${credentials}` } : {};

    if (isPdf(file)) {
      const authUrl = credentials
        ? `${fileUrl}?auth=${encodeURIComponent(credentials)}`
        : fileUrl;
      setIframeLoading(true);
      setViewing({ file, type: 'pdf', url: authUrl, fileUrl });
      return;
    }

    if (isVideo(file)) {
      // Fetch as blob then create object URL so auth header is sent
      fetch(fileUrl, { headers })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.blob();
        })
        .then(blob => {
          const objUrl = URL.createObjectURL(blob);
          setViewing({ file, type: 'video', url: objUrl, fileUrl });
        })
        .catch(err => alert(`ไม่สามารถเปิดไฟล์ได้: ${err.message}`));
      return;
    }

    if (isExcel(file)) {
      fetch(fileUrl, { headers })
        .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`)))
        .then(async buf => {
          const xlsx = await import('xlsx');
          const XLSX = xlsx.default || xlsx;
          const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
          const sheets = wb.SheetNames.map(name => ({
            name,
            html: XLSX.utils.sheet_to_html(wb.Sheets[name]),
          }));
          setViewing({ file, type: 'excel', sheets, activeSheet: 0 });
        })
        .catch(err => alert(`ไม่สามารถเปิดไฟล์ Excel ได้: ${err.message}`));
      return;
    }

    // Other file types: trigger authenticated download
    fetch(fileUrl, { headers })
      .then(r => r.ok ? r.blob() : Promise.reject(r.status))
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.FileName;
        a.click();
      })
      .catch(err => alert(`ดาวน์โหลดไม่ได้: ${err}`));
  };

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-mono text-steel-500 mb-6 flex-wrap">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span>/</span>}
              {i < breadcrumb.length - 1 ? (
                <button
                  onClick={() => crumb.id === null ? navigate('/portal') : navigate(`/portal/${crumb.id}`)}
                  className="text-steel-500 hover:text-brand transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-brand-ink">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>

        {/* Back link */}
        <Link
          to="/portal"
          className="inline-flex items-center gap-2 text-sm text-steel-500 hover:text-brand transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Portal
        </Link>

        {/* ── File Viewer (PDF / Video) ── */}
        {viewing && (
          <div className="mb-8 animate-fade-in">
            <div className="panel overflow-hidden">
              {/* Viewer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/70">
                <div className="flex items-center gap-2">
                  {viewing.type === 'pdf' ? (
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ) : viewing.type === 'excel' ? (
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                  <span className="font-mono text-sm text-brand">{viewing.file.FileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  {viewing.type !== 'video' && (
                    <a
                      href={newTabUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs py-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open in new tab
                    </a>
                  )}
                  <button
                    onClick={() => {
                      if (viewing?.url?.startsWith('blob:')) URL.revokeObjectURL(viewing.url);
                      setViewing(null);
                    }}
                    className="btn-secondary text-xs py-1.5"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* PDF embed */}
              {viewing.type === 'pdf' && (
                <iframe
                  src={viewing.url}
                  title={viewing.file.FileName}
                  className="w-full bg-slate-50"
                  style={{ height: '75vh' }}
                />
              )}

              {/* Video player */}
              {viewing.type === 'video' && (() => {
                const embed = resolveVideoEmbed(viewing.url);
                return embed?.type === 'iframe' ? (
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={embed.src}
                      title={viewing.file.FileName}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                ) : (
                  <video
                    controls
                    autoPlay
                    src={embed?.src}
                    className="w-full"
                    style={{ maxHeight: '75vh' }}
                  />
                );
              })()}

              {/* Excel viewer */}
              {viewing.type === 'excel' && (
                <div>
                  {viewing.sheets?.length > 1 && (
                    <div className="flex gap-2 px-5 py-2 border-b border-slate-100/70 overflow-x-auto bg-slate-50/30">
                      {viewing.sheets.map((s, i) => (
                        <button
                          key={s.name}
                          onClick={() => setViewing(v => ({ ...v, activeSheet: i }))}
                          className={`text-xs px-3 py-1 rounded-lg transition-colors flex-shrink-0 ${
                            viewing.activeSheet === i
                              ? 'bg-green-500/20 text-green-400 font-semibold'
                              : 'text-steel-500 hover:text-steel-300'
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div
                    className="overflow-auto bg-white"
                    style={{ maxHeight: '75vh' }}
                    dangerouslySetInnerHTML={{ __html: viewing.sheets?.[viewing.activeSheet]?.html || '' }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Subfolder grid ── */}
        {(childLoad || children.length > 0) && (
          <section className="mb-8">
            <h2 className="text-xs font-mono text-steel-500 uppercase tracking-widest mb-3">โฟลเดอร์</h2>
            {childLoad ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {children.map(f => (
                  <FolderCard key={f.Id} folder={f} onClick={handleSelectFolder} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── File list ── */}
        <section>
          <h2 className="text-xs font-mono text-steel-500 uppercase tracking-widest mb-3">ไฟล์</h2>
          <FileList
            files={files}
            loading={filesLoading}
            error={filesError}
            onOpenFile={handleOpenFile}
          />
        </section>
      </div>
    </PublicLayout>
  );
}
