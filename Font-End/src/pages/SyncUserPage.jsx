/**
 * SyncUserPage.jsx
 * ────────────────
 * Route: /sync
 *
 * หน้าสำหรับ Sync User โดยเฉพาะ — ทำได้แค่ trigger Folder Sync
 * แสดง: ชื่อ user, ปุ่ม "Sync Now", ผลลัพธ์หลัง sync
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { triggerSyncAsUser } from '../services/portal.service';

export default function SyncUserPage() {
  const { user, logout } = useAuth();
  const { toast }        = useToast();
  const navigate         = useNavigate();

  const [syncing, setSyncing] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const res = await triggerSyncAsUser();
      setResult(res.data);
      toast({ message: 'Sync เสร็จสมบูรณ์', type: 'success' });
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Sync ล้มเหลว';
      setError(msg);
      toast({ message: msg, type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin-login');
  };

  return (
    <div className="min-h-screen app-shell flex flex-col items-center justify-center p-6">
      {/* Card */}
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="panel p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display font-bold text-lg text-brand-ink">🔄 Folder Sync</h1>
              <p className="text-xs text-steel-500 mt-0.5 font-mono">
                สวัสดี, <span className="text-accent-400">{user?.username}</span>
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-steel-400 hover:text-red-400 transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>

          <p className="text-sm text-steel-400 mb-5 leading-relaxed">
            กดปุ่มด้านล่างเพื่ออัปเดตโครงสร้าง Folder บนเว็บไซต์
            ให้ตรงกับข้อมูลจริงใน Drive
            <br />
            <span className="text-xs text-amber-400/80 mt-1 block">
              ⚠️ สิทธิ์การเข้าถึง Folder จะยังคงเดิม ไม่ถูกเปลี่ยนแปลง
            </span>
          </p>

          <button
            onClick={handleSync}
            disabled={syncing}
            className={`w-full btn-primary py-3 text-base font-semibold flex items-center justify-center gap-2
              ${syncing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {syncing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                กำลัง Sync…
              </>
            ) : (
              <>🔄 Sync Now</>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="panel p-4 border border-red-500/30 bg-red-500/5 text-red-400 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="panel p-5">
            <h2 className="font-semibold text-sm text-brand-ink mb-3">✅ ผลการ Sync</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <StatItem label="เพิ่มใหม่"   value={result.inserted}    color="text-green-400" />
              <StatItem label="อัปเดต"      value={result.updated}     color="text-blue-400"  />
              <StatItem label="ลบออก"       value={result.deleted}     color="text-red-400"   />
              <StatItem label="ไฟล์ทั้งหมด" value={result.filesScanned} color="text-steel-300" />
            </dl>
            {result.durationMs != null && (
              <p className="text-xs text-steel-500 mt-3 font-mono">
                ใช้เวลา {(result.durationMs / 1000).toFixed(1)} วินาที
              </p>
            )}
            {result.errors?.length > 0 && (
              <div className="mt-3 text-xs text-amber-400">
                ⚠️ มีข้อผิดพลาด {result.errors.length} รายการ
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div className="bg-steel-100/5 rounded-lg p-3">
      <div className={`font-mono font-bold text-2xl ${color}`}>{value ?? 0}</div>
      <div className="text-xs text-steel-500 mt-0.5">{label}</div>
    </div>
  );
}
