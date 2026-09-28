/**
 * AdminPermissionsPage.jsx  (Admin Portal — Permission Editor)
 * Route: /administrator/portal/permissions/:folderId
 *
 * แสดงและจัดการสิทธิ์ AD Group ของ Folder
 * แสดงเฉพาะ canView (canUpload / canDelete ถูกซ่อน แต่ส่งไปเป็น false)
 * ชื่อ/พาธของโฟลเดอร์มาจาก adminGetFolders() (ไม่มี endpoint รายโฟลเดอร์)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  adminGetFolders,
  adminGetPermissions,
  adminSetPermission,
  adminRemovePermission,
} from '../../services/portal.service';
import PageHeader from '../../components/ui/PageHeader';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { LoadingState, EmptyState, ErrorState, apiError } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';

const LIST_PATH = '/administrator/portal/folders';

export default function AdminPermissionsPage() {
  const { folderId } = useParams();
  const navigate     = useNavigate();
  const { toast }    = useToast();
  const fid          = parseInt(folderId, 10);

  const [perms,      setPerms]      = useState([]);
  const [folders,    setFolders]    = useState(null);   // null = unknown (not loaded / failed)
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [adGroup,    setAdGroup]    = useState('');
  const [inputError, setInputError] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null); // AdGroup string
  const [removing,   setRemoving]   = useState(false);
  const inputRef = useRef(null);
  const reqSeq   = useRef(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    const seq = ++reqSeq.current;
    setError(null);
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [permList, folderList] = await Promise.all([
        adminGetPermissions(fid),
        // Folder list only supplies the name/path; the page still works without it
        adminGetFolders().catch(() => null),
      ]);
      if (seq !== reqSeq.current) return;
      setPerms(permList || []);
      if (folderList) setFolders(folderList);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      if (silent) toast({ message: apiError(e, 'โหลดสิทธิ์ใหม่ไม่สำเร็จ'), type: 'error' });
      else setError(apiError(e, 'โหลดสิทธิ์ไม่สำเร็จ'));
    } finally {
      if (seq === reqSeq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [fid, toast]);

  useEffect(() => {
    setFolders(null);
    setPerms([]);
    load();
  }, [load]);

  // Folder + ancestor chain for the header
  const folderInfo = useMemo(() => {
    if (!folders) return null;
    const byId = new Map(folders.map(f => [f.Id, f]));
    const folder = byId.get(fid);
    if (!folder) return { folder: null, ancestors: [] };
    const ancestors = [];
    const seen = new Set([folder.Id]);
    let cur = folder.ParentId != null ? byId.get(folder.ParentId) : null;
    while (cur && !seen.has(cur.Id)) {
      seen.add(cur.Id);
      ancestors.unshift(cur);
      cur = cur.ParentId != null ? byId.get(cur.ParentId) : null;
    }
    return { folder, ancestors };
  }, [folders, fid]);

  const folder = folderInfo?.folder || null;
  const isDeleted = folder && (folder.IsActive === false || folder.IsActive === 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (saving) return;
    const name = adGroup.trim();
    if (!name) { setInputError('กรุณาระบุชื่อ AD Group'); inputRef.current?.focus(); return; }
    if (perms.some(p => String(p.AdGroup).toLowerCase() === name.toLowerCase())) {
      setInputError(`“${name}” มีสิทธิ์อยู่แล้ว`);
      return;
    }
    setSaving(true);
    setInputError(null);
    try {
      await adminSetPermission({ folderId: fid, adGroup: name, canView: true, canUpload: false, canDelete: false });
      setAdGroup('');
      toast({ message: `เพิ่มสิทธิ์ให้ ${name} แล้ว`, type: 'success' });
      await load({ silent: true });
      inputRef.current?.focus();
    } catch (err) {
      toast({ message: apiError(err, 'เพิ่มสิทธิ์ไม่สำเร็จ'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      await adminRemovePermission(fid, removeTarget);
      toast({ message: `ลบสิทธิ์ของ ${removeTarget} แล้ว`, type: 'success' });
      setPerms(prev => prev.filter(p => p.AdGroup !== removeTarget));
      setRemoveTarget(null);
      await load({ silent: true });
    } catch (err) {
      toast({ message: apiError(err, 'ลบสิทธิ์ไม่สำเร็จ'), type: 'error' });
    } finally {
      setRemoving(false);
    }
  };

  const title = folder ? folder.FolderName : `โฟลเดอร์ #${folderId}`;
  const header = (
    <PageHeader
      icon="user-shield"
      title="จัดการสิทธิ์โฟลเดอร์"
      subtitle={loading ? 'กำหนดว่า AD Group ใดดูไฟล์ในโฟลเดอร์นี้ได้' : title}
      back={{ to: LIST_PATH, label: 'กลับไปหน้าจัดการโฟลเดอร์' }}
      actions={
        !loading && !error && folder ? (
          <button
            type="button"
            onClick={() => navigate(`/administrator/portal/folders/${fid}/edit`)}
            className="btn-secondary"
          >
            <FontAwesomeIcon icon={['fas', 'pen-to-square']} />
            แก้ไขโฟลเดอร์
          </button>
        ) : null
      }
    />
  );

  if (loading) {
    return (
      <div className="max-w-4xl">
        {header}
        <LoadingState rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        {header}
        <ErrorState message={error} onRetry={() => load()} />
      </div>
    );
  }

  if (folderInfo && !folder) {
    return (
      <div className="max-w-4xl">
        {header}
        <EmptyState
          icon="folder-open"
          title="ไม่พบโฟลเดอร์"
          message={`ไม่พบโฟลเดอร์รหัส ${folderId} อาจถูกลบไปแล้ว`}
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

  return (
    <div className="max-w-4xl space-y-5">
      {header}

      {/* ── folder info ── */}
      <section className="admin-card p-4 sm:p-5 flex items-start gap-4">
        <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl text-sky-600 bg-sky-50">
          <FontAwesomeIcon icon={['fas', 'folder']} />
        </span>
        <div className="min-w-0 flex-1">
          {folderInfo?.ancestors.length > 0 && (
            <nav aria-label="ตำแหน่งโฟลเดอร์" className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-500 mb-0.5">
              {folderInfo.ancestors.map(a => (
                <span key={a.Id} className="inline-flex items-center gap-1.5 min-w-0">
                  <span className="truncate max-w-[12rem]" title={a.FolderName}>{a.FolderName}</span>
                  <FontAwesomeIcon icon={['fas', 'chevron-right']} className="w-2 text-slate-300" />
                </span>
              ))}
            </nav>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800 break-words">{title}</h2>
            {isDeleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
                <FontAwesomeIcon icon={['fas', 'link-slash']} className="w-3" />
                ถูกลบจาก Sync
              </span>
            )}
            {folder?.IsHidden && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <FontAwesomeIcon icon={['fas', 'eye-slash']} className="w-3" />
                ซ่อนอยู่
              </span>
            )}
          </div>
          {folder?.FullPath && (
            <p className="font-mono text-sm text-slate-500 truncate mt-0.5" title={folder.FullPath}>
              {folder.FullPath}
            </p>
          )}
        </div>
      </section>

      {/* ── add permission ── */}
      <form onSubmit={handleAdd} noValidate className="admin-card p-4 sm:p-5">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <FontAwesomeIcon icon={['fas', 'user-plus']} className="text-brand" />
          เพิ่ม AD Group
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
          <div className="flex-1 min-w-0">
            <label htmlFor="adGroup" className="field-label">ชื่อ AD Group</label>
            <input
              id="adGroup"
              ref={inputRef}
              value={adGroup}
              onChange={e => { setAdGroup(e.target.value); if (inputError) setInputError(null); }}
              className={`input-field font-mono ${inputError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
              placeholder="เช่น hr-staff"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!inputError}
              aria-describedby="adGroup-hint"
            />
            {inputError
              ? <p id="adGroup-hint" className="field-error">{inputError}</p>
              : (
                <p id="adGroup-hint" className="field-hint">
                  กลุ่มที่เพิ่มจะได้สิทธิ์ <strong className="text-slate-700">ดูไฟล์</strong> ในโฟลเดอร์นี้ · กด Enter เพื่อเพิ่ม
                </p>
              )}
          </div>
          <button
            type="submit"
            disabled={saving || !adGroup.trim()}
            className="btn-primary sm:mt-[26px] shrink-0"
          >
            <FontAwesomeIcon icon={['fas', saving ? 'circle-notch' : 'plus']} spin={saving} />
            {saving ? 'กำลังเพิ่ม…' : 'เพิ่มสิทธิ์'}
          </button>
        </div>
      </form>

      {/* ── current permissions ── */}
      <section className="admin-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FontAwesomeIcon icon={['fas', 'users']} className="text-brand" />
            กลุ่มที่มีสิทธิ์
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-brand-soft text-brand text-sm font-semibold">{perms.length}</span>
          {refreshing && (
            <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="ml-auto text-slate-400" aria-label="กำลังโหลด" />
          )}
        </div>

        {perms.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
              <FontAwesomeIcon icon={['fas', 'user-lock']} />
            </div>
            <p className="text-base font-semibold text-slate-700">ยังไม่มีสิทธิ์ที่กำหนดโดยตรง</p>
            <p className="mt-1 text-base text-slate-500 max-w-md mx-auto">
              โฟลเดอร์นี้จะใช้สิทธิ์ของโฟลเดอร์แม่ที่ใกล้ที่สุด หากไม่มีการกำหนดเลย ผู้ใช้ทั่วไปจะเข้าไม่ได้
            </p>
          </div>
        ) : (
          <ul className="sb-stagger divide-y divide-slate-100">
            {perms.map(p => (
              <li key={p.AdGroup} className="flex items-center gap-3 py-2.5">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-soft text-brand">
                  <FontAwesomeIcon icon={['fas', 'user-group']} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-base font-medium text-slate-800 break-all">{p.AdGroup}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.CanView ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <FontAwesomeIcon icon={['fas', 'eye']} className="w-3" />
                        ดูไฟล์ได้
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                        <FontAwesomeIcon icon={['fas', 'eye-slash']} className="w-3" />
                        ดูไฟล์ไม่ได้
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveTarget(p.AdGroup)}
                  className="btn-icon btn-icon-danger"
                  aria-label={`ลบสิทธิ์ของ ${p.AdGroup}`}
                  title="ลบสิทธิ์"
                >
                  <FontAwesomeIcon icon={['fas', 'trash-can']} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => { if (!removing) setRemoveTarget(null); }}
        onConfirm={handleRemove}
        loading={removing}
        isDangerous
        title="ลบสิทธิ์"
        confirmText="ลบสิทธิ์"
        message={removeTarget && (
          <p>
            ต้องการลบสิทธิ์ของ <strong className="font-mono text-slate-800 break-all">{removeTarget}</strong> จากโฟลเดอร์
            {' '}<strong className="text-slate-800">“{title}”</strong> ใช่หรือไม่?
          </p>
        )}
      />
    </div>
  );
}
