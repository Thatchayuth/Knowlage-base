/**
 * FolderFormPage.jsx  (Admin Portal — Create/Edit Folder)
 * ──────────────────
 * Route: /administrator/portal/folders/new[?parentId=]
 *        /administrator/portal/folders/:id/edit
 *
 * - Loads the folder list once (parents + edit target).
 * - FullPath is editable only when creating (sync owns it afterwards).
 * - Parent select excludes the folder itself and its descendants.
 * - Icon is a FontAwesome class ("fa-solid fa-book") with live preview + presets.
 * - After saving, returns to the list with state.focusId so the row is highlighted.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { findIconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  adminGetFolders,
  adminCreateFolder,
  adminUpdateFolder,
} from '../../services/portal.service';
import PageHeader from '../../components/ui/PageHeader';
import Toggle from '../../components/ui/Toggle';
import { LoadingState, ErrorState, EmptyState, apiError } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';

const LIST_PATH = '/administrator/portal/folders';

// Column sizes in dbo.Folders
const MAX = { FolderName: 255, FullPath: 1000, Icon: 50, Description: 500 };

const ICON_PRESETS = [
  { name: 'folder',         label: 'โฟลเดอร์' },
  { name: 'folder-open',    label: 'โฟลเดอร์เปิด' },
  { name: 'file-lines',     label: 'เอกสาร' },
  { name: 'book',           label: 'หนังสือ / คู่มือ' },
  { name: 'clipboard-list', label: 'รายการตรวจสอบ' },
  { name: 'shield-halved',  label: 'ความปลอดภัย' },
  { name: 'chart-line',     label: 'รายงาน / สถิติ' },
  { name: 'gear',           label: 'การตั้งค่า' },
];

const INITIAL = {
  FolderName:  '',
  FullPath:    '',
  ParentId:    '',
  SortOrder:   0,
  Icon:        '',
  Description: '',
  IsHidden:    false,
};

// Same rule as the folder list: only real FA classes count; anything else → default folder.
const FA_STYLE = { 'fa-solid': 'fas', 'fa-regular': 'far', 'fa-brands': 'fab', fas: 'fas', far: 'far', fab: 'fab' };
function resolveFaIcon(value) {
  if (typeof value !== 'string' || !value.includes('fa-')) return null;
  const parts = value.trim().split(/\s+/);
  const style = parts.find(p => FA_STYLE[p]);
  const name  = parts.find(p => p.startsWith('fa-') && !FA_STYLE[p]);
  if (!name) return null;
  const def = findIconDefinition({ prefix: style ? FA_STYLE[style] : 'fas', iconName: name.slice(3) });
  return def ? [def.prefix, def.iconName] : null;
}

// Flat list in tree order with depth, for the parent <select>
function flattenTree(list) {
  const kids = new Map();
  list.forEach(f => {
    const key = f.ParentId ?? 'root';
    if (!kids.has(key)) kids.set(key, []);
    kids.get(key).push(f);
  });
  const ids = new Set(list.map(f => f.Id));
  const order = (a, b) =>
    (a.SortOrder ?? 0) - (b.SortOrder ?? 0) || String(a.FolderName).localeCompare(String(b.FolderName), 'th');
  const out = [];
  const seen = new Set();
  const walk = (nodes, depth) => {
    [...nodes].sort(order).forEach(n => {
      if (seen.has(n.Id)) return;
      seen.add(n.Id);
      out.push({ ...n, depth });
      walk(kids.get(n.Id) || [], depth + 1);
    });
  };
  // Roots = no parent, or a parent that is not in the list
  walk(list.filter(f => f.ParentId == null || !ids.has(f.ParentId)), 0);
  return out;
}

function descendantIds(list, id) {
  const kids = new Map();
  list.forEach(f => {
    if (f.ParentId == null) return;
    if (!kids.has(f.ParentId)) kids.set(f.ParentId, []);
    kids.get(f.ParentId).push(f.Id);
  });
  const out = new Set([id]);
  const stack = [id];
  while (stack.length) {
    (kids.get(stack.pop()) || []).forEach(c => {
      if (!out.has(c)) { out.add(c); stack.push(c); }
    });
  }
  return out;
}

const isInactive = f => f && (f.IsActive === false || f.IsActive === 0);

export default function FolderFormPage() {
  const { id }         = useParams();
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { toast }      = useToast();
  const isEdit         = !!id;
  const folderId       = isEdit ? parseInt(id, 10) : null;
  const defaultParentId = searchParams.get('parentId') || '';

  const [folders,     setFolders]     = useState([]);
  const [target,      setTarget]      = useState(null);
  const [form,        setForm]        = useState({ ...INITIAL, ParentId: defaultParentId });
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(null);
  const [notFound,    setNotFound]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const list = (await adminGetFolders()) || [];
      setFolders(list);
      if (isEdit) {
        const found = list.find(f => f.Id === folderId);
        if (!found) { setNotFound(true); return; }
        setTarget(found);
        setForm({
          FolderName:  found.FolderName  ?? '',
          FullPath:    found.FullPath    ?? '',
          ParentId:    found.ParentId != null ? String(found.ParentId) : '',
          SortOrder:   found.SortOrder   ?? 0,
          Icon:        found.Icon        ?? '',
          Description: found.Description ?? '',
          IsHidden:    !!found.IsHidden,
        });
      } else if (defaultParentId && !list.some(f => String(f.Id) === defaultParentId)) {
        // ?parentId points at nothing — fall back to top level
        setForm(f => ({ ...f, ParentId: '' }));
      }
    } catch (e) {
      setLoadError(apiError(e, 'โหลดข้อมูลโฟลเดอร์ไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }, [isEdit, folderId, defaultParentId]);

  useEffect(() => { load(); }, [load]);

  // Parent options: tree order, without the folder itself and its descendants
  const parentOptions = useMemo(() => {
    const blocked = isEdit ? descendantIds(folders, folderId) : new Set();
    return flattenTree(folders).filter(f => !blocked.has(f.Id));
  }, [folders, isEdit, folderId]);

  const selectedParent = useMemo(
    () => folders.find(f => String(f.Id) === String(form.ParentId)) || null,
    [folders, form.ParentId]
  );

  const setField = (name, value) => {
    setForm(f => ({ ...f, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(fe => ({ ...fe, [name]: undefined }));
  };
  const handleChange = e => setField(e.target.name, e.target.value);

  const validate = () => {
    const fe = {};
    if (!form.FolderName.trim()) fe.FolderName = 'กรุณาระบุชื่อโฟลเดอร์';
    if (!isEdit && !form.FullPath.trim()) fe.FullPath = 'กรุณาระบุ Full Path';
    if (form.SortOrder !== '' && !Number.isInteger(Number(form.SortOrder))) fe.SortOrder = 'ลำดับต้องเป็นจำนวนเต็ม';
    return fe;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const fe = validate();
    setFieldErrors(fe);
    if (Object.keys(fe).length) { setError(null); return; }

    setSaving(true);
    setError(null);
    const icon = form.Icon.trim();
    const payload = {
      FolderName:  form.FolderName.trim(),
      ParentId:    form.ParentId ? parseInt(form.ParentId, 10) : null,
      SortOrder:   parseInt(form.SortOrder, 10) || 0,
      Description: form.Description.trim(),
      IsHidden:    !!form.IsHidden,
    };
    try {
      let focusId;
      let name = payload.FolderName;
      if (isEdit) {
        // FullPath is owned by sync — not sent. Icon '' clears it.
        const res   = await adminUpdateFolder(folderId, { ...payload, Icon: icon });
        const saved = res?.data;
        focusId = saved?.Id ?? folderId;
        name    = saved?.FolderName ?? name;
      } else {
        const body = { ...payload, FullPath: form.FullPath.trim() };
        if (icon) body.Icon = icon; // empty → backend default
        const res = await adminCreateFolder(body);
        focusId = res?.data?.id ?? res?.data?.Id;
      }
      toast({ message: isEdit ? `บันทึก “${name}” แล้ว` : `เพิ่มโฟลเดอร์ “${name}” แล้ว`, type: 'success' });
      navigate(LIST_PATH, { state: focusId ? { focusId } : null });
    } catch (err) {
      const list = err?.response?.data?.errors;
      if (Array.isArray(list)) {
        const mapped = {};
        list.forEach(x => {
          const key = x.path || x.param;
          if (key && !mapped[key]) mapped[key] = x.msg;
        });
        setFieldErrors(mapped);
      }
      setError(apiError(err, 'บันทึกไม่สำเร็จ'));
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <PageHeader
      icon={isEdit ? 'pen-to-square' : 'folder-plus'}
      title={isEdit ? 'แก้ไขโฟลเดอร์' : 'เพิ่มโฟลเดอร์ใหม่'}
      subtitle={
        isEdit
          ? (target ? target.FolderName : 'แก้ไขชื่อ ตำแหน่ง และการแสดงผลของโฟลเดอร์')
          : 'เพิ่มโฟลเดอร์ที่ไม่ได้มาจากการ Sync'
      }
      back={{ to: LIST_PATH, label: 'กลับไปหน้าจัดการโฟลเดอร์' }}
    />
  );

  if (loading) {
    return (
      <div className="max-w-3xl">
        {header}
        <LoadingState rows={5} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl">
        {header}
        <ErrorState message={loadError} onRetry={load} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-3xl">
        {header}
        <EmptyState
          icon="folder-open"
          title="ไม่พบโฟลเดอร์"
          message={`ไม่พบโฟลเดอร์รหัส ${id} อาจถูกลบไปแล้ว`}
          action={
            <button type="button" onClick={() => navigate(LIST_PATH)} className="btn-primary">
              <FontAwesomeIcon icon={['fas', 'arrow-left']} />
              กลับไปหน้าจัดการโฟลเดอร์
            </button>
          }
        />
      </div>
    );
  }

  const iconDef      = resolveFaIcon(form.Icon);
  const iconInvalid  = form.Icon.trim() !== '' && !iconDef;
  const previewIcon  = iconDef || ['fas', 'folder'];
  const inputErr     = key => (fieldErrors[key] ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : '');

  return (
    <div className="max-w-3xl">
      {header}

      {isEdit && isInactive(target) && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-800">
          <FontAwesomeIcon icon={['fas', 'link-slash']} className="mt-1" />
          <p>
            โฟลเดอร์นี้ <strong>ถูกลบจาก Sync</strong> (ไม่พบบนไดรฟ์แล้ว) จึงไม่แสดงบนหน้าเว็บ
            จนกว่าการ Sync จะพบโฟลเดอร์นี้อีกครั้ง
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
          <FontAwesomeIcon icon={['fas', 'circle-exclamation']} className="mt-1" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* ── basic info ── */}
        <section className="admin-card p-5 sm:p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FontAwesomeIcon icon={['fas', 'circle-info']} className="text-brand" />
            ข้อมูลโฟลเดอร์
          </h2>

          <div>
            <label htmlFor="FolderName" className="field-label">ชื่อโฟลเดอร์ <span className="text-red-500">*</span></label>
            <input
              id="FolderName"
              name="FolderName"
              value={form.FolderName}
              onChange={handleChange}
              maxLength={MAX.FolderName}
              className={`input-field ${inputErr('FolderName')}`}
              placeholder="เช่น ฝ่ายบุคคล, คู่มือการทำงาน"
              aria-invalid={!!fieldErrors.FolderName}
              autoFocus={!isEdit}
            />
            {fieldErrors.FolderName && <p className="field-error">{fieldErrors.FolderName}</p>}
          </div>

          <div>
            <label htmlFor="FullPath" className="field-label">
              Full Path {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <input
              id="FullPath"
              name="FullPath"
              value={form.FullPath}
              onChange={handleChange}
              readOnly={isEdit}
              maxLength={MAX.FullPath}
              className={`input-field font-mono text-sm ${isEdit ? 'cursor-not-allowed' : ''} ${inputErr('FullPath')}`}
              placeholder={selectedParent?.FullPath ? `${selectedParent.FullPath}\\ชื่อโฟลเดอร์` : 'D:\\Shared\\HR'}
              title={isEdit ? form.FullPath : undefined}
              aria-invalid={!!fieldErrors.FullPath}
            />
            {fieldErrors.FullPath
              ? <p className="field-error">{fieldErrors.FullPath}</p>
              : isEdit
                ? (
                  <p className="field-hint">
                    <FontAwesomeIcon icon={['fas', 'lock']} className="mr-1.5 text-slate-400" />
                    กำหนดโดยการ Sync แก้ไขไม่ได้
                  </p>
                )
                : <p className="field-hint">พาธของโฟลเดอร์บนไดรฟ์ที่ใช้ร่วมกัน กำหนดได้ครั้งเดียวตอนสร้าง</p>}
          </div>

          <div>
            <label htmlFor="ParentId" className="field-label">โฟลเดอร์แม่</label>
            <select
              id="ParentId"
              name="ParentId"
              value={form.ParentId}
              onChange={handleChange}
              className={`input-field ${inputErr('ParentId')}`}
              aria-invalid={!!fieldErrors.ParentId}
            >
              <option value="">— ระดับบนสุด (ไม่มีโฟลเดอร์แม่) —</option>
              {parentOptions.map(p => (
                <option key={p.Id} value={p.Id}>
                  {'\u00A0\u00A0\u00A0'.repeat(p.depth)}{p.depth > 0 ? '└ ' : ''}{p.FolderName}
                  {isInactive(p) ? ' (ถูกลบจาก Sync)' : ''}
                </option>
              ))}
            </select>
            {fieldErrors.ParentId ? (
              <p className="field-error">{fieldErrors.ParentId}</p>
            ) : (
              <>
                {selectedParent?.FullPath && (
                  <p className="field-hint font-mono truncate" title={selectedParent.FullPath}>
                    {selectedParent.FullPath}
                  </p>
                )}
                {isEdit && (
                  <p className="field-hint">
                    เลือกโฟลเดอร์ย่อยของตัวเองไม่ได้ · หากเป็นโฟลเดอร์จาก Sync การ Sync ครั้งถัดไปจะจัดโฟลเดอร์แม่ตามโครงสร้างบนไดรฟ์
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label htmlFor="Description" className="field-label">คำอธิบาย</label>
            <textarea
              id="Description"
              name="Description"
              value={form.Description}
              onChange={handleChange}
              maxLength={MAX.Description}
              rows={3}
              className={`input-field resize-y ${inputErr('Description')}`}
              placeholder="อธิบายสั้น ๆ ว่าโฟลเดอร์นี้เก็บอะไร (ไม่บังคับ)"
            />
            {fieldErrors.Description
              ? <p className="field-error">{fieldErrors.Description}</p>
              : <p className="field-hint text-right">{form.Description.length}/{MAX.Description}</p>}
          </div>
        </section>

        {/* ── display ── */}
        <section className="admin-card p-5 sm:p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FontAwesomeIcon icon={['fas', 'palette']} className="text-brand" />
            การแสดงผล
          </h2>

          <div>
            <label htmlFor="Icon" className="field-label">ไอคอน</label>
            <div className="flex items-center gap-3">
              <span
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-lg text-sky-600 bg-sky-50 border border-sky-100"
                aria-hidden="true"
              >
                <FontAwesomeIcon icon={previewIcon} />
              </span>
              <input
                id="Icon"
                name="Icon"
                value={form.Icon}
                onChange={handleChange}
                maxLength={MAX.Icon}
                className={`input-field font-mono text-sm ${iconInvalid || fieldErrors.Icon ? 'border-amber-400' : ''}`}
                placeholder="fa-solid fa-folder"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="ไอคอนแนะนำ">
              {ICON_PRESETS.map(p => {
                const value  = `fa-solid fa-${p.name}`;
                const active = iconDef && iconDef[0] === 'fas' && iconDef[1] === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setField('Icon', value)}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20 ${
                      active
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-brand-soft hover:text-brand'
                    }`}
                    aria-pressed={!!active}
                    aria-label={p.label}
                    title={`${p.label} (${value})`}
                  >
                    <FontAwesomeIcon icon={['fas', p.name]} />
                  </button>
                );
              })}
              {form.Icon && (
                <button type="button" onClick={() => setField('Icon', '')} className="btn-ghost">
                  <FontAwesomeIcon icon={['fas', 'xmark']} />
                  ล้าง
                </button>
              )}
            </div>
            {fieldErrors.Icon ? (
              <p className="field-error">{fieldErrors.Icon}</p>
            ) : iconInvalid ? (
              <p className="field-hint text-amber-700">
                <FontAwesomeIcon icon={['fas', 'triangle-exclamation']} className="mr-1.5" />
                ไม่พบไอคอนนี้ ระบบจะแสดงไอคอนโฟลเดอร์ปกติแทน
              </p>
            ) : (
              <p className="field-hint">ใช้ชื่อคลาส FontAwesome เช่น fa-solid fa-book หรือเลือกจากไอคอนแนะนำ · เว้นว่างเพื่อใช้ไอคอนโฟลเดอร์ปกติ</p>
            )}
          </div>

          <div className="sm:max-w-[200px]">
            <label htmlFor="SortOrder" className="field-label">ลำดับการแสดง</label>
            <input
              id="SortOrder"
              name="SortOrder"
              type="number"
              inputMode="numeric"
              step={1}
              value={form.SortOrder}
              onChange={handleChange}
              className={`input-field ${inputErr('SortOrder')}`}
            />
            {fieldErrors.SortOrder
              ? <p className="field-error">{fieldErrors.SortOrder}</p>
              : <p className="field-hint">เลขน้อยแสดงก่อน</p>}
          </div>

          <div>
            <Toggle
              checked={!!form.IsHidden}
              onChange={v => setField('IsHidden', v)}
              label="ซ่อนโฟลเดอร์นี้จากหน้าเว็บ"
            />
            <p className="field-hint">ผู้ใช้ทั่วไปจะไม่เห็นโฟลเดอร์นี้ ผู้ดูแลยังจัดการได้ตามปกติ</p>
          </div>
        </section>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={() => navigate(LIST_PATH)} disabled={saving} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            <FontAwesomeIcon icon={['fas', saving ? 'circle-notch' : 'floppy-disk']} spin={saving} />
            {saving ? 'กำลังบันทึก…' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มโฟลเดอร์'}
          </button>
        </div>
      </form>
    </div>
  );
}
