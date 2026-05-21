/**
 * AdminSyncPage.jsx  (Admin Portal — Drive Sync)
 * ─────────────────
 * Route: /administrator/portal/sync
 *
 * Admin interface to trigger a full drive sync and view sync logs.
 * Uses existing btn-primary, input-field, table CSS patterns.
 *
 * Flow:
 *   Mount → adminGetSyncLogs() → show logs
 *   Admin clicks "Sync Now" → adminTriggerSync(rootPath)
 *   → show result summary + reload logs
 */

import { useState, useEffect } from 'react';
import { adminTriggerSync, adminGetSyncLogs } from '../../services/portal.service';
import { fetchSettings } from '../../services/services';

export default function AdminSyncPage() {
  const [rootPath, setRootPath] = useState('');
  const [dbRoot,   setDbRoot]   = useState('');
  const [syncing,  setSyncing]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [logs,     setLogs]     = useState([]);
  const [logLoad,  setLogLoad]  = useState(true);

  const loadLogs = async () => {
    setLogLoad(true);
    try {
      const data = await adminGetSyncLogs(30);
      setLogs(data || []);
    } catch { /* non-critical */ }
    finally { setLogLoad(false); }
  };

  useEffect(() => {
    loadLogs();
    fetchSettings().then(s => setDbRoot(s.portal_drive_root || '')).catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const data = await adminTriggerSync(rootPath || undefined);
      setResult(data.data);
      await loadLogs();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-display text-slate-100 mb-6">🔄 Sync Shared Drive</h1>

      {/* Sync trigger */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
        <label className="block text-sm text-slate-400 mb-1">
          Override Root Path
        </label>
        <p className="text-xs text-slate-500 mb-2">
          เว้นว่างเพื่อใช้ path ตั้งต้นจาก DB
          {dbRoot && <span className="ml-1 font-mono text-slate-400">({dbRoot})</span>}
        </p>
        <input
          value={rootPath}
          onChange={e => setRootPath(e.target.value)}
          className="input-field w-full font-mono text-sm mb-4"
          placeholder={dbRoot || 'D:\\Shared  หรือ  \\\\fileserver\\dept'}
        />
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-primary px-6 py-2"
        >
          {syncing ? '⏳ กำลัง Sync…' : '▶ Sync Now'}
        </button>
      </div>

      {/* Result summary */}
      {result && (
        <div className="bg-green-950 border border-green-800 rounded-xl p-4 mb-6 text-sm">
          <p className="text-green-300 font-medium mb-2">✅ Sync สำเร็จ</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              ['เพิ่ม',   result.inserted,    'text-green-400'],
              ['อัพเดต', result.updated,     'text-blue-400'],
              ['ลบ',      result.deleted,     'text-red-400'],
              ['ไฟล์',   result.filesScanned,'text-slate-300'],
            ].map(([label, val, cls]) => (
              <div key={label} className="bg-slate-800 rounded-lg p-2">
                <div className={`text-xl font-mono font-bold ${cls}`}>{val}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-2">
            ใช้เวลา {(result.durationMs / 1000).toFixed(1)}s
            {result.errors?.length > 0 && ` • ⚠️ ${result.errors.length} ข้อผิดพลาด`}
          </p>

          {result.inserted > 0 && (
            <div className="mt-3 p-3 bg-yellow-950/60 border border-yellow-700/40 rounded-lg">
              <p className="text-yellow-300 text-xs font-medium">
                ⚠️ มีโฟลเดอร์ใหม่ {result.inserted} รายการ — โฟลเดอร์ใหม่จาก Sync <strong>จะยังไม่แสดงให้ผู้ใช้เห็น</strong> จนกว่าจะกำหนดสิทธิ์ AD Group
              </p>
              <a
                href="/administrator/portal/folders"
                className="inline-block mt-2 text-xs text-accent-400 hover:text-accent-300 underline"
              >
                ➜ ไปกำหนดสิทธิ์โฟลเดอร์
              </a>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-6 text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Sync log table */}
      <h2 className="text-sm font-display text-slate-400 uppercase tracking-widest mb-3">
        Sync Logs (ล่าสุด 30 รายการ)
      </h2>
      {logLoad ? (
        <div className="skeleton h-32 rounded-xl" />
      ) : logs.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">ยังไม่มีประวัติ Sync</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">เวลา</th>
                <th className="px-3 py-2 text-left font-medium">ผู้ดำเนินการ</th>
                <th className="px-3 py-2 text-left font-medium">Path</th>
                <th className="px-3 py-2 text-left font-medium">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map(log => (
                <tr key={log.Id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap">
                    {new Date(log.CreatedAt).toLocaleString('th-TH')}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{log.Username || '—'}</td>
                  <td className="px-3 py-2 text-slate-400 font-mono truncate max-w-xs">{log.ResourcePath || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{log.Details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
