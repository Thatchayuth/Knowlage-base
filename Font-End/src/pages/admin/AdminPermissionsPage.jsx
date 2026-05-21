/**
 * AdminPermissionsPage.jsx  (Admin Portal — Permission Editor)
 * Route: /administrator/portal/permissions/:folderId
 *
 * แสดงและจัดการสิทธิ์ AD Group ของ Folder
 * แสดงเฉพาะ canView (canUpload / canDelete ถูกซ่อน)
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  adminGetPermissions,
  adminSetPermission,
  adminRemovePermission,
} from '../../services/portal.service';

// canView=true เสมอ, canUpload/canDelete ส่งไปด้วยแต่ไม่แสดง UI
const EMPTY_ROW = { adGroup: '', canView: true, canUpload: false, canDelete: false };

export default function AdminPermissionsPage() {
  const { folderId } = useParams();
  const navigate     = useNavigate();

  const [perms,   setPerms]   = useState([]);
  const [newPerm, setNewPerm] = useState({ ...EMPTY_ROW });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminGetPermissions(parseInt(folderId, 10));
      setPerms(data || []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [folderId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newPerm.adGroup.trim()) return;
    setSaving(true);
    try {
      await adminSetPermission({ folderId: parseInt(folderId, 10), ...newPerm });
      setNewPerm({ ...EMPTY_ROW });
      await load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (adGroup) => {
    if (!window.confirm(`ลบสิทธิ์ของ "${adGroup}" ใช่หรือไม่?`)) return;
    try {
      await adminRemovePermission(parseInt(folderId, 10), adGroup);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/administrator/portal/folders')}
          className="text-gray-500 hover:text-gray-700 text-sm font-medium"
        >
          ← กลับ
        </button>
        <h1 className="text-xl font-semibold text-gray-900">
          จัดการสิทธิ์ — Folder #{folderId}
        </h1>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {/* Add permission form */}
      <form
        onSubmit={handleAdd}
        className="bg-white rounded-xl p-4 mb-6 border border-gray-200 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-gray-700 mb-3">เพิ่ม AD Group</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-500 mb-1 font-medium">AD Group Name</label>
            <input
              value={newPerm.adGroup}
              onChange={e => setNewPerm(p => ({ ...p, adGroup: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="เช่น hr-staff"
              required
            />
          </div>
          {/* canView แสดงให้รู้ว่า checked ตลอด */}
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-default select-none">
            <input
              type="checkbox"
              checked={true}
              readOnly
              className="accent-blue-600 w-4 h-4"
            />
            Can View
          </label>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg shrink-0 transition-colors"
          >
            {saving ? '…' : '+ เพิ่ม'}
          </button>
        </div>
      </form>

      {/* Permission table */}
      {loading ? (
        <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
      ) : perms.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">ยังไม่มีสิทธิ์ที่กำหนด</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-gray-700">#</th>
                <th className="px-4 py-3 font-semibold text-gray-700">AD Group</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-center">Can View</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {perms.map((p, idx) => (
                <tr key={p.AdGroup} className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 text-gray-900 font-mono text-xs font-medium">{p.AdGroup}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(p.AdGroup)}
                      className="text-xs border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded-lg transition-colors"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
