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
  const [progress, setProgress] = useState(0);
  const [useBlobFallback, setUseBlobFallback] = useState(false);

  const [prevFileId, setPrevFileId] = useState(fileId);
  if (fileId !== prevFileId) {
    setPrevFileId(fileId);
    setUseBlobFallback(false);
  }

  const fileName = stateFile?.FileName || `File #${fileId}`;

  const apiBase = getApiBaseUrl();
  const fileUrl = `${apiBase}/api/portal/files/${fileId}`;
  const credentials = sessionStorage.getItem("km_credentials");
  const newTabUrl = credentials
    ? `${fileUrl}?auth=${encodeURIComponent(credentials)}`
    : fileUrl;

  useEffect(() => {
    const apiBase = getApiBaseUrl();
    const fileUrl = `${apiBase}/api/portal/files/${fileId}`;
    const credentials = sessionStorage.getItem("km_credentials");
    const headers = credentials
      ? { Authorization: `Basic ${credentials}` }
      : {};

    let blobUrl = null;
    let mounted = true;

    // Check if we know it's a video file beforehand
    const isVid = stateFile && (
      /\.(mp4|webm|ogg|ogv|avi|wmv|flv|mkv|mov|m4v|3gp|mpg|mpeg)$/i.test(stateFile.FileName) || 
      String(stateFile.MimeType || "").startsWith("video/")
    );
    
    // Check if it's natively playable
    const isNativeVid = isVid && (
      /\.(mp4|webm|ogg|ogv)$/i.test(stateFile.FileName) ||
      ["video/mp4", "video/webm", "video/ogg"].includes(stateFile.MimeType)
    );

    const isPdf = stateFile && (
      /\.pdf$/i.test(stateFile.FileName) || 
      String(stateFile.MimeType || "").startsWith("application/pdf")
    );

    // 0. If PDF, stream instantly!
    if (isPdf && credentials) {
      const authUrl = `${fileUrl}?auth=${encodeURIComponent(credentials)}`;
      setViewing({ url: authUrl, type: "pdf" });
      setLoading(false);
      return;
    }

    // 1. If native video, stream instantly! (Only if not falling back to blob)
    if (isNativeVid && credentials && !useBlobFallback) {
      const authUrl = `${fileUrl}?auth=${encodeURIComponent(credentials)}`;
      setViewing({ url: authUrl, type: "video" });
      setLoading(false);
      return;
    }

    // 2. If unsupported video with local path, open externally instantly!
    if (isVid && !isNativeVid && stateFile?.FullPath) {
      const url = `kmportal://open?type=${encodeURIComponent(
        stateFile.MimeType || "video",
      )}&path=${encodeURIComponent(stateFile.FullPath)}`;

      window.location.href = url;

      setViewing({
        type: "external",
        externalUrl: url,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setViewing(null);
    setProgress(0);

    fetch(fileUrl, { headers })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} – ไม่สามารถเปิดไฟล์ได้`);
        
        const contentLength = response.headers.get("content-length");
        const ct = response.headers.get("content-type") || "";

        const isNative = /\.(mp4|webm|ogg|ogv)$/i.test(fileName) || 
                         ct === "video/mp4" || 
                         ct === "video/webm" || 
                         ct === "video/ogg";

        if (ct.startsWith("video/") && isNative && credentials && !useBlobFallback) {
          if (response.body) {
            try { response.body.cancel(); } catch (e) {}
          }
          const authUrl = `${fileUrl}?auth=${encodeURIComponent(credentials)}`;
          throw { isStreamRedirect: true, authUrl, type: "video" };
        }

        if (isPdfMime(ct) && credentials) {
          if (response.body) {
            try { response.body.cancel(); } catch (e) {}
          }
          const authUrl = `${fileUrl}?auth=${encodeURIComponent(credentials)}`;
          throw { isStreamRedirect: true, authUrl, type: "pdf" };
        }

        if (!contentLength || !response.body) {
          const blob = await response.blob();
          return { blob, ct };
        }

        const total = parseInt(contentLength, 10);
        const reader = response.body.getReader();
        let receivedLength = 0;
        let chunks = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          receivedLength += value.length;
          
          if (total > 0 && mounted) {
            const percent = Math.round((receivedLength / total) * 100);
            setProgress(percent);
          }
        }

        const blob = new Blob(chunks, { type: ct });
        return { blob, ct };
      })
      .then(async ({ blob, ct }) => {
        if (!mounted) return;

        if (isPdfMime(ct)) {
          blobUrl = URL.createObjectURL(blob);
          setViewing({ url: blobUrl, type: "pdf" });
        } else if (ct.startsWith("video/")) {
          blobUrl = URL.createObjectURL(blob);
          const isNative = /\.(mp4|webm|ogg|ogv)$/i.test(fileName) || 
                           ct === "video/mp4" || 
                           ct === "video/webm" || 
                           ct === "video/ogg";
          if (isNative) {
            setViewing({ url: blobUrl, type: "video", isBlobFallback: true });
          } else {
            if (stateFile?.FullPath) {
              const url = `kmportal://open?type=${encodeURIComponent(
                stateFile.MimeType || ct || "file",
              )}&path=${encodeURIComponent(stateFile.FullPath)}`;

              window.location.href = url;

              setViewing({
                type: "external",
                externalUrl: url,
                url: blobUrl,
              });
            } else {
              setViewing({ url: blobUrl, type: "unsupported_video" });
            }
          }
        } else if (isExcelMime(ct)) {
          blobUrl = URL.createObjectURL(blob);
          const url = `kmportal://open?type=${encodeURIComponent(
            stateFile?.MimeType || ct || "file",
          )}&path=${encodeURIComponent(stateFile?.FullPath || "")}`;

          window.location.href = url;

          setViewing({
            type: "external",
            externalUrl: url,
            url: blobUrl,
          });
        } else {
          blobUrl = URL.createObjectURL(blob);
          setViewing({ url: blobUrl, type: "pdf" });
        }
      })
      .catch((err) => {
        if (mounted) {
          if (err && err.isStreamRedirect) {
            setViewing({ url: err.authUrl, type: err.type || "video" });
          } else {
            setError(err.message);
          }
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [fileId, useBlobFallback]);

  const handleDownload = () => {
    if (!viewing?.url) return;
    const a = document.createElement("a");
    a.href = viewing.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
          <div className="flex flex-col items-center justify-center gap-5 py-24">
            <Spinner size="lg" />
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <p className="text-slate-400 text-sm font-mono font-medium">
                กำลังโหลดไฟล์... {progress > 0 ? `${progress}%` : ''}
              </p>
              {progress > 0 && (
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800/40 rounded-full overflow-hidden border border-slate-200/50">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-150 ease-out" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
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

              {viewing.url && viewing.type !== "video" && viewing.type !== "unsupported_video" && (
                <a
                  href={newTabUrl}
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
                autoPlay
                crossOrigin="anonymous"
                src={viewing.url}
                className="w-full"
                style={{ maxHeight: "75vh" }}
                onError={() => {
                  if (!viewing.isBlobFallback) {
                    console.log("Streaming failed, falling back to blob...");
                    setUseBlobFallback(true);
                  }
                }}
              />
            )}

            {/* Unsupported Video */}
            {viewing.type === "unsupported_video" && (
              <div className="flex flex-col items-center justify-center py-20 px-6 gap-6 bg-slate-900 text-white rounded-b-2xl border-t border-slate-800">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-3xl">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                
                <div className="text-center max-w-md space-y-2">
                  <h4 className="font-display font-bold text-lg text-slate-100">
                    เบราว์เซอร์ไม่รองรับการเล่นไฟล์ .avi โดยตรง
                  </h4>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    เนื่องจากข้อจำกัดของเว็บเบราว์เซอร์ในไฟล์รูปแบบ AVI กรุณาดาวน์โหลดไฟล์เพื่อนำไปเปิดด้วยโปรแกรมเล่นสื่อในเครื่องของคุณ (เช่น VLC หรือ Windows Media Player)
                  </p>
                </div>

                <button
                  onClick={handleDownload}
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3 font-semibold shadow-lg hover:scale-[1.02] transition-all text-sm cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  ดาวน์โหลดไฟล์วิดีโอเพื่อรับชม
                </button>
              </div>
            )}

            {/* External opener */}
            {viewing.type === "external" && (
              <div className="flex flex-col items-center justify-center py-20 px-6 gap-6 text-white text-center">
                <div className="text-5xl animate-bounce">📂</div>

                <div className="space-y-2 max-w-md">
                  <p className="text-slate-200 font-semibold text-lg">
                    กำลังเปิดไฟล์ผ่านโปรแกรมภายนอก...
                  </p>

                  <p className="text-slate-400 text-xs leading-relaxed">
                    ระบบพยายามเรียกเปิดโปรแกรมในเครื่องของคุณอัตโนมัติ (เช่น KM Portal หรือโปรแกรมเล่นสื่อสำหรับวิดีโอ) หากเงียบไป หรือไม่มีโปรแกรมในเครื่อง สามารถเลือกใช้ตัวช่วยด้านล่างได้ครับ
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a 
                    href={viewing.externalUrl} 
                    className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-sm"
                  >
                    เปิดไฟล์อีกครั้ง (Retry)
                  </a>
                  {viewing.url && (
                    <button
                      onClick={handleDownload}
                      className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-sm cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      ดาวน์โหลดไฟล์ลงเครื่อง
                    </button>
                  )}
                </div>
              </div>
            )}  
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
