/**
 * FolderFormPage.jsx  (Admin Portal — Create/Edit Folder)
 * ──────────────────
 * Route: /administrator/portal/folders/new
 *        /administrator/portal/folders/:id/edit
 *
 * Create or edit a folder entry.
 * Uses existing input-field, btn-primary CSS classes.
 */

import { useState, useEffect }                    from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  adminGetFolders,
  adminCreateFolder,
  adminUpdateFolder,
} from '../../services/portal.service';

const INITIAL = {
  FolderName:  '',
  FullPath:    '',
  ParentId:    '',
  SortOrder:   0,
  Icon:        '',
  Description: '',
  IsHidden:    false,
};

export default function FolderFormPage() {
  const { id }         = useParams();
  const [searchParams] = useSearchParams();
  const isEdit         = !!id;
  const navigate       = useNavigate();

  const defaultParentId = searchParams.get('parentId') || '';

  const [form,    setForm]    = useState({ ...INITIAL, ParentId: defaultParentId });
  const [parents, setParents] = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    adminGetFolders().then(data => setParents(data || [])).catch(() => {});
    if (isEdit) {
      adminGetFolders().then(data => {
        const target = data.find(f => f.Id === parseInt(id, 10));
        if (target) setForm({
          ...INITIAL,
          ...target,
          ParentId:    target.ParentId    ?? '',
          Icon:        target.Icon        ?? '',
          Description: target.Description ?? '',
        });
      });
    }
  }, [id, isEdit]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      ParentId:  form.ParentId ? parseInt(form.ParentId, 10) : null,
      SortOrder: parseInt(form.SortOrder, 10) || 0,
    };
    try {
      if (isEdit) {
        await adminUpdateFolder(parseInt(id, 10), payload);
      } else {
        await adminCreateFolder(payload);
      }
      navigate('/administrator/portal/folders');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-display text-slate-100 mb-6">
        {isEdit ? 'แก้ไขโฟลเดอร์' : 'เพิ่มโฟลเดอร์ใหม่'}
      </h1>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">ชื่อโฟลเดอร์ *</label>
          <input name="FolderName" value={form.FolderName} onChange={handleChange}
            required className="input-field w-full" placeholder="เช่น HR, Salary" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Full Path *</label>
          <input name="FullPath" value={form.FullPath} onChange={handleChange}
            required className="input-field w-full font-mono text-sm" placeholder="D:\Shared\HR" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">โฟลเดอร์แม่</label>
          <select name="ParentId" value={form.ParentId} onChange={handleChange} className="input-field w-full">
            <option value="">— Root (ไม่มีแม่) —</option>
            {parents.filter(p => p.Id !== parseInt(id, 10)).map(p => (
              <option key={p.Id} value={p.Id}>{p.FolderName} ({p.FullPath})</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Sort Order</label>
            <input name="SortOrder" type="number" value={form.SortOrder} onChange={handleChange}
              className="input-field w-full" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Icon (emoji)</label>
            <input name="Icon" value={form.Icon} onChange={handleChange}
              className="input-field w-full" placeholder="📁" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">คำอธิบาย</label>
          <input name="Description" value={form.Description} onChange={handleChange}
            className="input-field w-full" />
        </div>
        <div className="flex items-center gap-2">
          <input name="IsHidden" id="isHidden" type="checkbox" checked={!!form.IsHidden} onChange={handleChange}
            className="accent-accent-400" />
          <label htmlFor="isHidden" className="text-sm text-slate-400">ซ่อนโฟลเดอร์นี้ (Hidden)</label>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary px-6 py-2">
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
          <button type="button" onClick={() => navigate('/administrator/portal/folders')}
            className="text-slate-400 hover:text-slate-200 text-sm">
            ยกเลิก
          </button>
        </div>
      </form>
    </div>
  );
}
