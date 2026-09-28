/**
 * AdminSyncUsersPage.jsx
 * ──────────────────────
 * Route: /administrator/portal/sync-users
 *
 * Admin จัดการรายชื่อ User ที่มีสิทธิ์ trigger Sync โดยเฉพาะ
 * (ไม่ใช่ admin กลุ่ม ICT แต่เป็น User รายบุคคลที่เพิ่มไว้ใน DB)
 */

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { adminGetSyncUsers, adminAddSyncUser, adminRemoveSyncUser } from '../../services/portal.service';
import { useToast } from '../../components/ui/Toast';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { LoadingState, EmptyState, ErrorState, apiError } from '../../components/ui/States';

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  // CreatedAt holds Thai wall-clock time that the mssql driver labels as UTC — don't shift it.
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function AdminSyncUsersPage() {
  const { toast } = useToast();

  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [newUser,   setNewUser]   = useState('');
  const [adding,    setAdding]    = useState(false);
  const [addError,  setAddError]  = useState(null);
  const [target,    setTarget]    = useState(null);  // user ที่รอยืนยันลบ
  // Separate from target so the name stays in the dialog while it animates closed.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing,  setRemoving]  = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await adminGetSyncUsers();
      setUsers(data || []);
    } catch (err) {
      setLoadError(apiError(err, 'โหลดรายชื่อผู้ใช้ Sync ไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleAdd = async (e) => {
    e.preventDefault();
    const username = newUser.trim().toLowerCase();
    if (!username || adding) return;

    setAdding(true);
    setAddError(null);
    try {
      await adminAddSyncUser(username);
      toast({ message: `เพิ่ม ${username} เป็นผู้ใช้ Sync แล้ว`, type: 'success' });
      setNewUser('');
      await load();
    } catch (err) {
      const msg = apiError(err, 'เพิ่มผู้ใช้ Sync ไม่สำเร็จ');
      setAddError(msg);
      toast({ message: msg, type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!target) return;
    setRemoving(true);
    try {
      await adminRemoveSyncUser(target.Id);
      toast({ message: `ลบ ${target.Username} แล้ว`, type: 'success' });
      setUsers(prev => prev.filter(u => u.Id !== target.Id));
      setConfirmOpen(false);
    } catch (err) {
      toast({ message: apiError(err, 'ลบผู้ใช้ Sync ไม่สำเร็จ'), type: 'error' });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <PageHeader
        icon="user-gear"
        title="ผู้ใช้ Sync"
        subtitle="ผู้ใช้รายบุคคลที่กด Sync Drive ได้ (ไม่มีสิทธิ์จัดการโฟลเดอร์หรือสิทธิ์การเข้าถึง)"
      />

      <div className="space-y-6">
        {/* ── Add form ─────────────────────────────────────────── */}
        <section className="admin-card p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg bg-brand-soft text-brand">
              <FontAwesomeIcon icon={['fas', 'user-plus']} />
            </span>
            <h2 className="font-display font-bold text-lg text-slate-800">เพิ่มผู้ใช้ Sync</h2>
          </div>
          <form onSubmit={handleAdd} noValidate>
            <label htmlFor="sync-username" className="field-label">Username</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="sync-username"
                type="text"
                value={newUser}
                onChange={e => { setNewUser(e.target.value); if (addError) setAddError(null); }}
                placeholder="เช่น john.doe"
                className="input-field font-mono flex-1"
                disabled={adding}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={!!addError}
                aria-describedby="sync-username-hint"
              />
              <button
                type="submit"
                className="btn-primary sm:min-w-[140px]"
                disabled={adding || !newUser.trim()}
              >
                {adding
                  ? <><FontAwesomeIcon icon={['fas', 'circle-notch']} spin /> กำลังเพิ่ม…</>
                  : <><FontAwesomeIcon icon={['fas', 'plus']} /> เพิ่ม</>}
              </button>
            </div>
            {addError
              ? <p className="field-error" role="alert">{addError}</p>
              : <p id="sync-username-hint" className="field-hint">ใช้ username เดียวกับที่ใช้เข้าสู่ระบบ (domain user) ไม่ต้องใส่ชื่อ domain</p>}
          </form>
        </section>

        {/* ── User list ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display font-bold text-lg text-slate-800">รายชื่อปัจจุบัน</h2>
            {!loading && !loadError && (
              <span className="px-3 py-1 rounded-full bg-brand-soft text-brand text-sm font-semibold">
                {users.length} คน
              </span>
            )}
          </div>

          {loading ? (
            <LoadingState rows={3} />
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={load} />
          ) : users.length === 0 ? (
            <EmptyState icon="users" title="ยังไม่มีผู้ใช้ Sync" message="เพิ่ม username จากช่องด้านบน" />
          ) : (
            <ul className="admin-card divide-y divide-slate-100 overflow-hidden">
              {users.map(u => (
                <li key={u.Id} className="flex items-center gap-4 px-5 py-4">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                    <FontAwesomeIcon icon={['fas', 'user']} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-semibold text-base text-slate-800 truncate">{u.Username}</p>
                    <p className="text-sm text-slate-500 flex flex-wrap gap-x-3">
                      <span>เพิ่มโดย <span className="font-mono text-slate-700">{u.CreatedBy || '—'}</span></span>
                      <span>{formatDate(u.CreatedAt)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setTarget(u); setConfirmOpen(true); }}
                    className="btn-icon btn-icon-danger"
                    title={`ลบ ${u.Username}`}
                    aria-label={`ลบ ${u.Username}`}
                  >
                    <FontAwesomeIcon icon={['fas', 'trash-can']} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Info box ─────────────────────────────────────────── */}
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-base text-sky-900">
          <FontAwesomeIcon icon={['fas', 'circle-info']} className="mt-1 flex-shrink-0" />
          <p className="leading-relaxed">
            การเพิ่มหรือลบผู้ใช้<strong>มีผลทันที</strong> ตั้งแต่คำขอถัดไปของผู้ใช้คนนั้น ไม่ต้องรอให้ออกจากระบบ
            — ผู้ใช้ที่เคยถูกลบสามารถเพิ่มกลับได้ด้วย username เดิม
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => !removing && setConfirmOpen(false)}
        onConfirm={handleRemove}
        loading={removing}
        isDangerous
        title="ลบผู้ใช้ Sync"
        message={
          <>ลบ <span className="font-mono font-semibold text-slate-800">{target?.Username}</span> ออกจากผู้ใช้ Sync? ผู้ใช้คนนี้จะกด Sync ไม่ได้ทันที</>
        }
        confirmText="ลบผู้ใช้"
      />
    </div>
  );
}
