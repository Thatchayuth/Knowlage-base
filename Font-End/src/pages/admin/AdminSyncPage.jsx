/**
 * AdminSyncPage.jsx  (Admin Portal — Drive Sync)
 * ─────────────────
 * Route: /administrator/portal/sync
 *
 * Admin interface to trigger a drive sync (real or dry run) and view sync logs.
 *
 * Flow:
 *   Mount → adminGetSyncLogs() + adminFetchSettings() (portal_drive_root)
 *   Admin clicks "เริ่ม Sync" → adminTriggerSync(rootPath)  (dry run → POST with dryRun:true)
 *   → show result summary + reload logs
 *
 * Sync result fields (folderSync.service syncDrive):
 *   dryRun, rootPath, inserted, updated, deleted, filesScanned, durationMs,
 *   errors: string[], permissionErrors: string[], wouldDelete: {id,path}[], outOfScope: string[]
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import api from '../../services/axios';
import { adminTriggerSync, adminGetSyncLogs } from '../../services/portal.service';
import { adminFetchSettings } from '../../services/services';
import PageHeader from '../../components/ui/PageHeader';
import Toggle from '../../components/ui/Toggle';
import Collapse from '../../components/ui/Collapse';
import { LoadingState, EmptyState, ErrorState, apiError } from '../../components/ui/States';

const LOG_LIMIT = 30;
const SYNC_TIMEOUT_MS = 400000; // same as adminTriggerSync (server closes the socket at 360s)

/** Dry run: same endpoint as adminTriggerSync, plus dryRun:true (service has no dry-run option). */
const triggerDryRun = (rootPath) =>
  api.post('/api/portal/admin/sync', { rootPath, dryRun: true }, { timeout: SYNC_TIMEOUT_MS }).then(r => r.data);

// ── helpers ──────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const formatElapsed = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

function formatDuration(ms) {
  if (ms == null || isNaN(ms)) return '—';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} วินาที`;
  const m = Math.floor(s / 60);
  return `${m} นาที ${Math.round(s - m * 60)} วินาที`;
}

function formatDateTime(v, { dbLocal = false } = {}) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    ...(dbLocal ? { timeZone: 'UTC' } : {}),
  });
}

// DB columns filled by GETDATE() hold Thai wall-clock time, but the mssql driver
// (useUTC default) labels them as UTC. Show them as-is instead of shifting +7h.
const formatDbDateTime = v => formatDateTime(v, { dbLocal: true });

function parseDetails(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Turn a failed sync request into { kind, title, message, runningSince? }. */
function describeSyncError(err) {
  const status = err?.response?.status;
  const data   = err?.response?.data;
  if (status === 409 || data?.code === 'SYNC_IN_PROGRESS') {
    return {
      kind: 'busy',
      title: 'กำลัง Sync อยู่',
      message: 'มีการ Sync อื่นกำลังทำงานอยู่ (อาจเป็น Auto-Sync หรือผู้ใช้อื่น) กรุณารอให้เสร็จแล้วลองใหม่',
      runningSince: data?.runningSince || null,
    };
  }
  if (!err?.response) {
    // Timeout / socket closed (server closes at ~6 min) / network down
    return {
      kind: 'unknown',
      title: 'ไม่ได้รับผลลัพธ์จาก Server',
      message: 'การเชื่อมต่อหมดเวลาหรือขาดไประหว่าง Sync — Sync อาจยังทำงานต่ออยู่บน Server กรุณาตรวจสอบประวัติการ Sync ด้านล่างอีกครั้งในภายหลัง',
    };
  }
  return {
    kind: 'error',
    title: status === 400 ? 'ข้อมูลไม่ถูกต้อง' : 'Sync ไม่สำเร็จ',
    message: apiError(err, 'Sync ไม่สำเร็จ'),
  };
}

// ── small UI pieces ──────────────────────────────────────────────
const STAT_TONES = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  sky:     'border-sky-200 bg-sky-50 text-sky-700',
  red:     'border-red-200 bg-red-50 text-red-700',
  slate:   'border-slate-200 bg-slate-50 text-slate-700',
};

function Stat({ icon, label, value, tone }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${STAT_TONES[tone]}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <FontAwesomeIcon icon={['fas', icon]} /> {label}
      </div>
      <div className="mt-1 font-display font-bold text-2xl text-slate-800">{value ?? 0}</div>
    </div>
  );
}

function ExpandableList({ open, onToggle, icon, tone, title, items, mono = true }) {
  const tones = {
    red:   'border-red-200 bg-red-50/60 text-red-800',
    amber: 'border-amber-200 bg-amber-50/70 text-amber-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
  };
  return (
    <div className={`rounded-2xl border ${tones[tone]}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full min-h-[48px] flex items-center gap-3 px-4 py-2 text-left text-base font-semibold rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand/15"
      >
        <FontAwesomeIcon icon={['fas', icon]} className="flex-shrink-0" />
        <span className="flex-1">{title}</span>
        <span className="text-sm font-medium">{open ? 'ซ่อน' : 'ดูรายการ'}</span>
        <FontAwesomeIcon icon={['fas', 'chevron-down']} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <Collapse open={open}>
        <ul className="max-h-72 overflow-y-auto border-t border-black/5 px-4 py-3 space-y-2">
          {items.map((t, i) => (
            <li key={i} className={`text-sm leading-relaxed text-slate-700 break-all ${mono ? 'font-mono' : ''}`}>{t}</li>
          ))}
        </ul>
      </Collapse>
    </div>
  );
}

function ResultCard({ result }) {
  const [openList, setOpenList] = useState(null);
  const toggle = (k) => setOpenList(v => (v === k ? null : k));

  const errors      = result.errors || [];
  const permErrors  = result.permissionErrors || [];
  const wouldDelete = result.wouldDelete || [];
  const dry         = !!result.dryRun;
  const hasProblems = errors.length > 0 || permErrors.length > 0;

  const head = dry
    ? { icon: 'flask', cls: 'bg-sky-50 text-sky-700', title: 'ผลการทดลอง Sync (Dry run)', sub: 'ยังไม่มีการเปลี่ยนแปลงข้อมูลใด ๆ — ตัวเลขด้านล่างคือสิ่งที่จะเกิดขึ้นถ้า Sync จริง' }
    : hasProblems
      ? { icon: 'triangle-exclamation', cls: 'bg-amber-50 text-amber-700', title: 'Sync เสร็จ แต่มีบางรายการผิดพลาด', sub: 'ดูรายละเอียดข้อผิดพลาดด้านล่าง' }
      : { icon: 'circle-check', cls: 'bg-emerald-50 text-emerald-700', title: 'Sync สำเร็จ', sub: 'ข้อมูลโฟลเดอร์และไฟล์อัปเดตแล้ว' };

  return (
    <section className="admin-card p-5 sm:p-6 animate-fade-in" aria-live="polite">
      <div className="flex items-start gap-3 mb-5">
        <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg ${head.cls}`}>
          <FontAwesomeIcon icon={['fas', head.icon]} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-lg text-slate-800">{head.title}</h2>
          <p className="text-base text-slate-500">{head.sub}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon="folder-plus"  label={dry ? 'จะเพิ่ม' : 'เพิ่ม'}      value={result.inserted}     tone="emerald" />
        <Stat icon="pen"          label={dry ? 'จะอัปเดต' : 'อัปเดต'}   value={result.updated}      tone="sky" />
        <Stat icon="folder-minus" label={dry ? 'จะลบ' : 'ลบ'}         value={result.deleted ?? wouldDelete.length} tone="red" />
        <Stat icon="file-lines"   label="ไฟล์ที่สแกน"                   value={result.filesScanned} tone="slate" />
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 text-base">
        <div className="flex gap-2 min-w-0">
          <dt className="text-slate-500 flex-shrink-0">Path:</dt>
          <dd className="font-mono text-slate-800 truncate" title={result.rootPath}>{result.rootPath || '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">ใช้เวลา:</dt>
          <dd className="text-slate-800">{formatDuration(result.durationMs)}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3">
        {permErrors.length > 0 && (
          <ExpandableList
            open={openList === 'perm'} onToggle={() => toggle('perm')}
            icon="lock" tone="amber" items={permErrors}
            title={`อ่านโฟลเดอร์ไม่ได้ (ไม่มีสิทธิ์) ${permErrors.length} รายการ — โฟลเดอร์ย่อยเหล่านี้จะไม่ถูกลบ`}
          />
        )}
        {errors.length > 0 && (
          <ExpandableList
            open={openList === 'err'} onToggle={() => toggle('err')}
            icon="circle-xmark" tone="red" items={errors}
            title={`ข้อผิดพลาด ${errors.length} รายการ`}
          />
        )}
        {wouldDelete.length > 0 && (
          <ExpandableList
            open={openList === 'del'} onToggle={() => toggle('del')}
            icon="folder-minus" tone="slate" items={wouldDelete.map(d => d.path)}
            title={`โฟลเดอร์ที่${dry ? 'จะถูก' : 'ถูก'}ลบออกจากระบบ ${wouldDelete.length} รายการ`}
          />
        )}

        {!dry && result.inserted > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <FontAwesomeIcon icon={['fas', 'user-lock']} className="text-amber-700 text-lg flex-shrink-0" />
            <p className="flex-1 text-base text-amber-900">
              มีโฟลเดอร์ใหม่ {result.inserted} รายการ — ผู้ใช้<strong>จะยังไม่เห็น</strong>จนกว่าจะกำหนดสิทธิ์ AD Group
            </p>
            <Link to="/administrator/portal/folders" className="btn-secondary">
              <FontAwesomeIcon icon={['fas', 'arrow-right']} /> ไปกำหนดสิทธิ์
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function SyncErrorCard({ error, onRetryLogs }) {
  const style = {
    busy:    { icon: 'hourglass-half',       cls: 'border-amber-200 bg-amber-50',  iconCls: 'bg-white text-amber-600', title: 'text-amber-900' },
    unknown: { icon: 'wifi',                 cls: 'border-amber-200 bg-amber-50',  iconCls: 'bg-white text-amber-600', title: 'text-amber-900' },
    error:   { icon: 'circle-xmark',         cls: 'border-red-200 bg-red-50',      iconCls: 'bg-white text-red-600',   title: 'text-red-800' },
  }[error.kind];
  return (
    <div className={`rounded-[24px] border p-5 flex flex-col sm:flex-row gap-4 ${style.cls}`} role="alert">
      <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg shadow-sm ${style.iconCls}`}>
        <FontAwesomeIcon icon={['fas', style.icon]} />
      </span>
      <div className="flex-1 min-w-0">
        <h2 className={`font-display font-bold text-lg ${style.title}`}>{error.title}</h2>
        <p className="mt-1 text-base text-slate-700 break-words">{error.message}</p>
        {error.runningSince && (
          <p className="mt-1 text-base text-slate-700">
            เริ่มทำงานเมื่อ <strong>{formatDateTime(error.runningSince)}</strong>
          </p>
        )}
        {error.kind !== 'error' && (
          <button type="button" onClick={onRetryLogs} className="btn-secondary mt-3">
            <FontAwesomeIcon icon={['fas', 'rotate-right']} /> โหลดประวัติการ Sync ใหม่
          </button>
        )}
      </div>
    </div>
  );
}

function LogItem({ log }) {
  const d   = parseDetails(log.Details);
  const dry = log.Action === 'SYNC_DRYRUN' || !!d?.dryRun;
  const errCount = typeof d?.errors === 'number' ? d.errors : Array.isArray(d?.errors) ? d.errors.length : 0;

  return (
    <li className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5">
      <div className="lg:w-60 flex-shrink-0 flex flex-wrap items-center gap-2">
        <span className="text-base text-slate-800 font-medium">{formatDbDateTime(log.CreatedAt)}</span>
        {dry ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <FontAwesomeIcon icon={['fas', 'flask']} className="text-xs" /> ทดลอง
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-brand-soft text-brand border border-brand/15">
            <FontAwesomeIcon icon={['fas', 'rotate']} className="text-xs" /> จริง
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-slate-600">
          <span className="inline-flex items-center gap-2">
            <FontAwesomeIcon icon={['fas', 'user']} className="text-slate-500 text-sm" />
            <span className="font-mono text-slate-800">{log.Username || '—'}</span>
          </span>
          {d?.durationMs != null && (
            <span className="inline-flex items-center gap-2">
              <FontAwesomeIcon icon={['fas', 'stopwatch']} className="text-slate-500 text-sm" />
              {formatDuration(d.durationMs)}
            </span>
          )}
        </div>
        {log.ResourcePath && (
          <p className="font-mono text-sm text-slate-600 truncate" title={log.ResourcePath}>{log.ResourcePath}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        {d ? (
          <>
            <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700">เพิ่ม {d.inserted ?? 0}</span>
            <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-sky-50 text-sky-700">อัปเดต {d.updated ?? 0}</span>
            <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-red-50 text-red-700">ลบ {d.deleted ?? 0}</span>
            <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700">ไฟล์ {d.filesScanned ?? 0}</span>
            {errCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-amber-100 text-amber-800">
                <FontAwesomeIcon icon={['fas', 'triangle-exclamation']} className="mr-1" />ผิดพลาด {errCount}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-slate-500 break-all">{log.Details || '—'}</span>
        )}
      </div>
    </li>
  );
}

// ── page ─────────────────────────────────────────────────────────
export default function AdminSyncPage() {
  const [rootPath, setRootPath] = useState('');
  const [dbRoot,   setDbRoot]   = useState('');
  const [rootLoad, setRootLoad] = useState(true);
  const [rootErr,  setRootErr]  = useState(false);
  const [dryRun,   setDryRun]   = useState(false);
  const [syncing,  setSyncing]  = useState(false);
  const [elapsed,  setElapsed]  = useState(0);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [logs,     setLogs]     = useState([]);
  const [logLoad,  setLogLoad]  = useState(true);
  const [logError, setLogError] = useState(null);
  const mounted = useRef(true);

  // Set true on every mount: StrictMode mounts → unmounts → mounts again in dev,
  // and a cleanup-only effect would leave the flag false and freeze the page.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadLogs = async () => {
    setLogLoad(true);
    setLogError(null);
    try {
      const data = await adminGetSyncLogs(LOG_LIMIT);
      if (mounted.current) setLogs(data || []);
    } catch (e) {
      if (mounted.current) setLogError(apiError(e, 'โหลดประวัติการ Sync ไม่สำเร็จ'));
    } finally {
      if (mounted.current) setLogLoad(false);
    }
  };

  useEffect(() => {
    loadLogs();
    adminFetchSettings()
      .then(s => setDbRoot(s?.portal_drive_root || ''))
      .catch(() => setRootErr(true))
      .finally(() => setRootLoad(false));
  }, []); // eslint-disable-line

  // Elapsed timer + leave-page warning while syncing
  useEffect(() => {
    if (!syncing) return undefined;
    const started = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearInterval(t);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [syncing]);

  const handleSync = async () => {
    const override = rootPath.trim();
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const data = dryRun
        ? await triggerDryRun(override || undefined)
        : await adminTriggerSync(override || undefined);
      if (!mounted.current) return;
      setResult(data?.data || null);
      loadLogs();
    } catch (e) {
      if (!mounted.current) return;
      setError(describeSyncError(e));
      loadLogs();
    } finally {
      if (mounted.current) setSyncing(false);
    }
  };

  // If settings could not be loaded, don't block — the server validates the path anyway.
  const noRoot  = !rootLoad && !rootErr && !dbRoot;
  const canSync = !syncing && !rootLoad && !noRoot;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <PageHeader
        icon="rotate"
        title="Sync Drive"
        subtitle="ดึงโครงสร้างโฟลเดอร์และไฟล์จาก Shared Drive เข้าสู่ระบบ"
        actions={
          <Link to="/administrator/portal/folders" className="btn-secondary">
            <FontAwesomeIcon icon={['fas', 'folder-tree']} /> จัดการโฟลเดอร์
          </Link>
        }
      />

      <div className="space-y-6">
        {/* ── Trigger card ─────────────────────────────────────── */}
        <section className="admin-card p-5 sm:p-6">
          <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg bg-emerald-50 text-emerald-700">
              <FontAwesomeIcon icon={['fas', 'hard-drive']} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-bold text-lg text-slate-800">Shared Drive ตั้งต้น</h2>
              {rootLoad ? (
                <div className="skeleton h-5 w-64 mt-1" />
              ) : dbRoot ? (
                <p className="font-mono text-base text-slate-700 break-all">{dbRoot}</p>
              ) : rootErr ? (
                <p className="text-base text-amber-700">โหลด Path ไม่สำเร็จ — ยัง Sync ได้ตามปกติ</p>
              ) : (
                <p className="text-base text-slate-500">ยังไม่ได้ตั้งค่า</p>
              )}
            </div>
            <Link to="/administrator/settings" className="btn-ghost flex-shrink-0" title="แก้ไข Path ใน ตั้งค่าเว็บไซต์">
              <FontAwesomeIcon icon={['fas', 'pen']} /> <span className="hidden sm:inline">แก้ไข</span>
            </Link>
          </div>

          {noRoot ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <FontAwesomeIcon icon={['fas', 'triangle-exclamation']} className="text-amber-700 text-lg flex-shrink-0" />
              <p className="flex-1 text-base text-amber-900">
                ต้องตั้งค่า Path ของ Shared Drive ที่หน้า “ตั้งค่าเว็บไซต์” ก่อนจึงจะ Sync ได้
              </p>
              <Link to="/administrator/settings" className="btn-secondary">
                <FontAwesomeIcon icon={['fas', 'sliders']} /> ไปตั้งค่า
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label htmlFor="override-root" className="field-label">Sync เฉพาะโฟลเดอร์ (ไม่บังคับ)</label>
                <input
                  id="override-root"
                  value={rootPath}
                  onChange={e => setRootPath(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && canSync) handleSync(); }}
                  className="input-field font-mono"
                  placeholder="เว้นว่างเพื่อ Sync ทั้ง Drive"
                  disabled={syncing}
                  spellCheck={false}
                />
                <p className="field-hint">
                  เว้นว่างเพื่อ Sync ทั้ง Drive — ถ้าระบุ ต้องเป็น Path ตั้งต้นด้านบนหรือโฟลเดอร์ย่อยภายในเท่านั้น
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <Toggle
                  checked={dryRun}
                  onChange={setDryRun}
                  disabled={syncing}
                  label="ทดลองก่อน (Dry run) — แสดงผลว่าจะเปลี่ยนอะไร โดยไม่บันทึกจริง"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button type="button" onClick={handleSync} disabled={!canSync} className="btn-primary sm:min-w-[200px]">
                  {syncing ? (
                    <><FontAwesomeIcon icon={['fas', 'circle-notch']} spin /> กำลัง Sync… {formatElapsed(elapsed)}</>
                  ) : dryRun ? (
                    <><FontAwesomeIcon icon={['fas', 'flask']} /> เริ่มทดลอง Sync</>
                  ) : (
                    <><FontAwesomeIcon icon={['fas', 'play']} /> เริ่ม Sync</>
                  )}
                </button>
                {syncing && (
                  <div className="flex items-start gap-2 text-base text-amber-800" role="status">
                    <FontAwesomeIcon icon={['fas', 'triangle-exclamation']} className="mt-1 flex-shrink-0" />
                    <span>
                      <strong>อย่าปิดหน้านี้ระหว่าง Sync</strong> — Drive ขนาดใหญ่อาจใช้เวลาหลายนาที
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Result / error ───────────────────────────────────── */}
        {result && <ResultCard result={result} />}
        {error && <SyncErrorCard error={error} onRetryLogs={loadLogs} />}

        {/* ── Sync logs ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display font-bold text-lg text-slate-800">
              ประวัติการ Sync <span className="text-base font-normal text-slate-500">(ล่าสุด {LOG_LIMIT} รายการ)</span>
            </h2>
            <button type="button" onClick={loadLogs} disabled={logLoad} className="btn-icon" title="โหลดใหม่" aria-label="โหลดประวัติใหม่">
              <FontAwesomeIcon icon={['fas', 'rotate-right']} spin={logLoad} />
            </button>
          </div>

          {logLoad && logs.length === 0 ? (
            <LoadingState rows={4} />
          ) : logError ? (
            <ErrorState message={logError} onRetry={loadLogs} />
          ) : logs.length === 0 ? (
            <EmptyState icon="clock-rotate-left" title="ยังไม่มีประวัติ Sync" message="เมื่อมีการ Sync (รวมถึง Auto-Sync) รายการจะแสดงที่นี่" />
          ) : (
            <ul className="admin-card divide-y divide-slate-100 overflow-hidden">
              {logs.map(log => <LogItem key={log.Id} log={log} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
