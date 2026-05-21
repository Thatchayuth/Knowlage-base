/**
 * AdminSyncUsersPage.jsx
 * ──────────────────────
 * Route: /administrator/portal/sync-users
 *
 * Admin จัดการรายชื่อ User ที่มีสิทธิ์ trigger Sync โดยเฉพาะ
 * (ไม่ใช่ admin กลุ่ม ICT แต่เป็น User รายบุคคลที่เพิ่มไว้ใน DB)
 */

import { useState, useEffect } from 'react';
import { adminGetSyncUsers, adminAddSyncUser, adminRemoveSyncUser } from '../../services/portal.service';
import { useToast } from '../../components/ui/Toast';

export default function AdminSyncUsersPage() {
  const { toast } = useToast();

  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [newUser,  setNewUser]  = useState('');
  const [adding,   setAdding]   = useState(false);
  const [removing, setRemoving] = useState(null); // id ที่กำลังลบ

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminGetSyncUsers();
      setUsers(data || []);
    } catch {
      toast({ message: 'โหลดรายชื่อ Sync Users ไม่สำเร็จ', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const username = newUser.trim().toLowerCase();
    if (!username) return;

    setAdding(true);
    try {
      await adminAddSyncUser(username);
      toast({ message: `เพิ่ม ${username} เป็น Sync User แล้ว`, type: 'success' });
      setNewUser('');
      await load();
    } catch (err) {
      const msg = err.response?.data?.message || 'เพิ่ม Sync User ไม่สำเร็จ';
      toast({ message: msg, type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id, username) => {
    if (!window.confirm(`ลบ Sync User "${username}" ออกจากระบบ?`)) return;
    setRemoving(id);
    try {
      await adminRemoveSyncUser(id);
      toast({ message: `ลบ ${username} แล้ว`, type: 'success' });
      setUsers(prev => prev.filter(u => u.Id !== id));
    } catch {
      toast({ message: 'ลบ Sync User ไม่สำเร็จ', type: 'error' });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl text-brand-ink">👤 Sync Users</h1>
        <p className="text-sm text-steel-500 mt-1">
          User รายบุคคลที่มีสิทธิ์ <strong>trigger Sync</strong> เท่านั้น
          (ไม่มีสิทธิ์จัดการ Folder หรือ Permission)
        </p>
      </div>

      {/* Add form */}
      <div className="panel p-5 mb-6">
        <h2 className="font-semibold text-sm text-brand-ink mb-3">เพิ่ม Sync User</h2>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="text"
            value={newUser}
            onChange={e => setNewUser(e.target.value)}
            placeholder="Username (เช่น john.doe)"
            className="input-field flex-1"
            disabled={adding}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn-primary px-5"
            disabled={adding || !newUser.trim()}
          >
            {adding ? 'กำลังเพิ่ม…' : '+ เพิ่ม'}
          </button>
        </form>
        <p className="text-xs text-steel-500 mt-2">
          ใช้ username เดียวกับที่ใช้ login เข้าระบบ (domain user)
        </p>
      </div>

      {/* User list */}
      <div className="panel overflow-hidden">
        <div className="px-5 py-3 border-b border-steel-200/20 flex items-center justify-between">
          <span className="font-semibold text-sm text-brand-ink">รายชื่อปัจจุบัน</span>
          <span className="text-xs font-mono text-steel-500">{users.length} user{users.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-steel-500 text-sm">กำลังโหลด…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-steel-500 text-sm">
            ยังไม่มี Sync User — เพิ่มจากช่องด้านบน
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-steel-100/10 text-steel-500 text-xs uppercase tracking-wider">
                <th className="px-5 py-2 text-left">Username</th>
                <th className="px-5 py-2 text-left">เพิ่มโดย</th>
                <th className="px-5 py-2 text-left">วันที่เพิ่ม</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.Id} className="border-t border-steel-200/10 hover:bg-steel-100/5">
                  <td className="px-5 py-3 font-mono font-semibold text-accent-400">
                    {u.Username}
                  </td>
                  <td className="px-5 py-3 text-steel-400">{u.CreatedBy}</td>
                  <td className="px-5 py-3 text-steel-400 text-xs">
                    {new Date(u.CreatedAt).toLocaleDateString('th-TH', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => handleRemove(u.Id, u.Username)}
                      disabled={removing === u.Id}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                    >
                      {removing === u.Id ? '…' : 'ลบ'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info box */}
      <div className="mt-4 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-amber-300">
        <strong>หมายเหตุ:</strong> หลังจากลบ Sync User อาจใช้เวลาสูงสุด 5 นาทีกว่า session เก่าจะหมดอายุ
        เนื่องจาก auth cache TTL = 5 นาที
      </div>
    </div>
  );
}
