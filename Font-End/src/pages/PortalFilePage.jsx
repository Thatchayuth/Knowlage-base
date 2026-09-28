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
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import PublicLayout from "../layouts/PublicLayout";
import Spinner from "../components/ui/Spinner";
import { getApiBaseUrl } from "../services/axios";

function isPdfMime(ct) {
  return ct === "application/pdf" || ct?.startsWith("application/pdf");
}
/** Last folder name of a UNC/drive path. */
function parentFolder(p = "") {
  const parts = String(p).split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : "";
}
function isExcelMime(ct) {
  return ct.includes("spreadsheet") || ct === "application/vnd.ms-excel";
}

export default function PortalFilePage() {
  const { fileId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const stateFile = location.state?.file; // { Id, FileName, MimeType, ... }

  const [viewing, setViewing] = useState(null); // { url?, type: 'pdf'|'video'|'excel', sheets?, activeSheet? }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [useBlobFallback, setUseBlobFallback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error "retry" button

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
  }, [fileId, useBlobFallback, reloadKey]);

  const handleDownload = () => {
    if (!viewing?.url) return;
    const a = document.createElement("a");
    a.href = viewing.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Go back to wherever the user came from (search, folder, home tree);
  // a direct link has no in-app history, so fall back to home.
  const handleBack = () => {
    if (location.key && location.key !== "default") navigate(-1);
    else navigate("/");
  };

  const isVideoName = /\.(mp4|webm|ogg|ogv|avi|wmv|flv|mkv|mov|m4v|3gp|mpg|mpeg)$/i.test(fileName);
  const kind = /\.pdf$/i.test(fileName) || viewing?.type === "pdf"
    ? { icon: "file-pdf", color: "text-red-500", bg: "bg-red-50" }
    : isVideoName
      ? { icon: "file-video", color: "text-purple-500", bg: "bg-purple-50" }
      : { icon: "file-excel", color: "text-emerald-600", bg: "bg-emerald-50" };
  const displayName = fileName.replace(/\.[^.\\/]+$/, "");
  const folderName = parentFolder(stateFile?.FullPath);
  const canNewTab = viewing?.url && viewing.type !== "video" && viewing.type !== "unsupported_video";

  return (
    <PublicLayout>
      <div className="max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 py-5 animate-fade-in">
        {/* Back */}
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 h-11 px-5 mb-4 rounded-full bg-white/80 border border-slate-200 text-base font-semibold text-slate-600 shadow-sm hover:bg-white hover:text-brand hover:border-brand/30 transition-colors"
        >
          <FontAwesomeIcon icon={["fas", "arrow-left"]} className="w-4" />
          ย้อนกลับ
        </button>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-5 py-24">
            <Spinner size="lg" />
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <p className="text-slate-500 text-base font-medium">
                กำลังโหลดไฟล์... {progress > 0 ? `${progress}%` : ""}
              </p>
              {progress > 0 && (
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-150 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-[24px] bg-white border border-slate-200 shadow-sm p-10 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center text-red-500 text-2xl">
              <FontAwesomeIcon icon={["fas", "triangle-exclamation"]} />
            </div>
            <h2 className="font-display font-bold text-xl text-slate-800">เปิดไฟล์ไม่สำเร็จ</h2>
            <p className="mt-1 text-red-600 text-sm">{error}</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setReloadKey(k => k + 1)} className="btn-primary">
                <FontAwesomeIcon icon={["fas", "rotate-right"]} /> ลองใหม่
              </button>
              <button type="button" onClick={handleBack} className="btn-secondary">
                ย้อนกลับ
              </button>
            </div>
          </div>
        )}

        {/* Viewer */}
        {viewing && !loading && (
          <div className="rounded-[24px] bg-white border border-slate-200 overflow-hidden shadow-[0_1px_2px_rgba(10,24,85,0.06),0_8px_24px_-8px_rgba(10,24,85,0.15)] animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${kind.bg} ${kind.color}`}>
                  <FontAwesomeIcon icon={["fas", kind.icon]} />
                </span>
                <div className="min-w-0">
                  <h1 className="font-display font-bold text-lg lg:text-xl text-slate-800 truncate" title={fileName}>
                    {displayName}
                  </h1>
                  {folderName && (
                    <p className="text-sm text-slate-400 truncate flex items-center gap-1.5" title={stateFile?.FullPath}>
                      <FontAwesomeIcon icon={["fas", "folder"]} className="w-3" />
                      {folderName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {viewing.url && (
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:text-brand hover:border-brand/30 transition-colors inline-flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={["fas", "download"]} className="w-3.5" />
                    <span className="hidden sm:inline">ดาวน์โหลด</span>
                  </button>
                )}
                {canNewTab && (
                  <a
                    href={newTabUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:text-brand hover:border-brand/30 transition-colors inline-flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={["fas", "up-right-from-square"]} className="w-3.5" />
                    <span className="hidden sm:inline">เปิดแท็บใหม่</span>
                  </a>
                )}
              </div>
            </div>

            {/* PDF embed — fills the screen below the header */}
            {viewing.type === "pdf" && (
              <iframe
                src={viewing.url}
                title={fileName}
                className="w-full bg-slate-50 block"
                style={{ height: "calc(100vh - 230px)", minHeight: 480 }}
              />
            )}

            {/* Video player */}
            {viewing.type === "video" && (
              <div className="bg-black">
                <video
                  controls
                  autoPlay
                  crossOrigin="anonymous"
                  src={viewing.url}
                  className="w-full block mx-auto"
                  style={{ maxHeight: "calc(100vh - 230px)" }}
                  onError={() => {
                    if (!viewing.isBlobFallback) {
                      console.log("Streaming failed, falling back to blob...");
                      setUseBlobFallback(true);
                    }
                  }}
                />
              </div>
            )}

            {/* Unsupported Video */}
            {viewing.type === "unsupported_video" && (
              <div className="flex flex-col items-center justify-center py-20 px-6 gap-6 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 text-2xl">
                  <FontAwesomeIcon icon={["fas", "triangle-exclamation"]} />
                </div>
                <div className="max-w-md space-y-2">
                  <h2 className="font-display font-bold text-lg text-slate-800">
                    เบราว์เซอร์ไม่รองรับการเล่นไฟล์นี้โดยตรง
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    กรุณาดาวน์โหลดไฟล์แล้วเปิดด้วยโปรแกรมเล่นสื่อในเครื่อง (เช่น VLC หรือ Windows Media Player)
                  </p>
                </div>
                <button type="button" onClick={handleDownload} className="btn-primary px-6 py-3">
                  <FontAwesomeIcon icon={["fas", "download"]} /> ดาวน์โหลดไฟล์วิดีโอ
                </button>
              </div>
            )}

            {/* External opener */}
            {viewing.type === "external" && (
              <div className="flex flex-col items-center justify-center py-20 px-6 gap-6 text-center">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl ${kind.bg} ${kind.color}`}>
                  <FontAwesomeIcon icon={["fas", kind.icon]} />
                </div>
                <div className="space-y-2 max-w-md">
                  <p className="font-display font-bold text-xl text-slate-800">
                    <FontAwesomeIcon icon={["fas", "circle-notch"]} spin className="mr-2 text-brand" />
                    กำลังเปิดไฟล์ด้วยโปรแกรมในเครื่อง…
                  </p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    ถ้าโปรแกรมไม่เปิดขึ้นมา กด "เปิดอีกครั้ง" หรือดาวน์โหลดไฟล์ไปเปิดเอง
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a href={viewing.externalUrl} className="btn-secondary px-5 py-2.5">
                    <FontAwesomeIcon icon={["fas", "rotate-right"]} /> เปิดอีกครั้ง
                  </a>
                  {viewing.url && (
                    <button type="button" onClick={handleDownload} className="btn-primary px-5 py-2.5">
                      <FontAwesomeIcon icon={["fas", "download"]} /> ดาวน์โหลดไฟล์
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
