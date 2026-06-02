/**
 * PortalFilePage.jsx
 * ──────────────────
 * Displays a single file (PDF or video) fetched via authenticated backend endpoint.
 * Route: /portal/file/:fileId
 *
 * File metadata (FileName, etc.) is expected in location.state.file (passed by the
 * sidebar when navigating). Falls back to a generic label if not present.
 *
 * Flow:
 *   sidebar click → navigate('/portal/file/:id', { state: { file } })
 *   → fetch blob with Basic Auth header
 *   → createObjectURL → render iframe (PDF) or <video>
 */

import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import PublicLayout from "../layouts/PublicLayout";
import Spinner from "../components/ui/Spinner";
import { getApiBaseUrl } from "../services/axios";

function isPdfMime(ct) {
  return ct === "application/pdf" || ct?.startsWith("application/pdf");
}
function isExcelMime(ct) {
  return ct.includes("spreadsheet") || ct === "application/vnd.ms-excel";
}

export default function PortalFilePage() {
  const { fileId } = useParams();
  const location = useLocation();
  const stateFile = location.state?.file; // { Id, FileName, MimeType, ... }

  const [viewing, setViewing] = useState(null); // { url?, type: 'pdf'|'video'|'excel', sheets?, activeSheet? }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fileName = stateFile?.FileName || `File #${fileId}`;

  useEffect(() => {
    const apiBase = getApiBaseUrl();
    const fileUrl = `${apiBase}/api/portal/files/${fileId}`;
    const credentials = sessionStorage.getItem("km_credentials");
    const headers = credentials
      ? { Authorization: `Basic ${credentials}` }
      : {};

    let blobUrl = null;

    setLoading(true);
    setError(null);
    setViewing(null);

    fetch(fileUrl, { headers })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} – ไม่สามารถเปิดไฟล์ได้`);
        const ct = r.headers.get("content-type") || "";
        return r.blob().then((blob) => ({ blob, ct }));
      })
      .then(async ({ blob, ct }) => {
        if (isPdfMime(ct)) {
          blobUrl = URL.createObjectURL(blob);
          setViewing({ url: blobUrl, type: "pdf" });
        } else if (ct.startsWith("video/")) {
          blobUrl = URL.createObjectURL(blob);
          setViewing({ url: blobUrl, type: "video" });
        } else if (isExcelMime(ct)) {
          const url = `kmportal://open?type=${encodeURIComponent(
            stateFile?.MimeType || ct || "file",
          )}&path=${encodeURIComponent(stateFile?.FullPath || "")}`;

          window.location.href = url;

          setViewing({
            type: "external",
            externalUrl: url,
          });
        } else {
          blobUrl = URL.createObjectURL(blob);
          setViewing({ url: blobUrl, type: "pdf" });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [fileId]);

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">
        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-steel-500 hover:text-brand transition-colors mb-6"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to home
        </Link>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Spinner size="lg" />
            <p className="text-slate-400 text-sm font-mono">กำลังโหลดไฟล์…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="panel p-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-400 font-mono text-sm mb-4">{error}</p>
            <Link to="/" className="btn-secondary">
              Go home
            </Link>
          </div>
        )}

        {/* Viewer */}
        {viewing && !loading && (
          <div className="panel overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/70">
              <div className="flex items-center gap-2">
                {viewing.type === "pdf" ? (
                  <svg
                    className="w-4 h-4 text-orange-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                ) : viewing.type === "excel" ? (
                  <svg
                    className="w-4 h-4 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
                <span className="font-mono text-sm text-brand truncate max-w-lg">
                  {fileName}
                </span>
              </div>

              {viewing.url && (
                <a
                  href={viewing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs py-1.5 flex-shrink-0"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  Open in new tab
                </a>
              )}
            </div>

            {/* PDF embed */}
            {viewing.type === "pdf" && (
              <iframe
                src={viewing.url}
                title={fileName}
                className="w-full bg-slate-50"
                style={{ height: "75vh" }}
              />
            )}

            {/* Video player */}
            {viewing.type === "video" && (
              <video
                controls
                src={viewing.url}
                className="w-full"
                style={{ maxHeight: "75vh" }}
              />
            )}

            {/* External opener */}
            {viewing.type === "external" && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="text-5xl">📂</div>

                <div className="text-center">
                  <p className="text-slate-200 font-medium mb-2">
                    Opening file externally...
                  </p>

                  <p className="text-slate-400 text-sm">
                    หากโปรแกรมไม่เปิดอัตโนมัติ กดปุ่มด้านล่าง
                  </p>
                </div>

                <a href={viewing.externalUrl} className="btn-secondary">
                  Open File
                </a>
              </div>
            )}  
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
