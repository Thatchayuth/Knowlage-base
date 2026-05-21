/**
 * useFolderFiles.js
 * ─────────────────
 * React hook: fetch the file list for a specific folder.
 * Used by FolderViewPage.jsx.
 *
 * @param {number|string|null} folderId — if null, does nothing
 * Returns: { files, loading, error, refetch }
 */

import { useState, useEffect, useCallback } from 'react';
import { getFolderFiles } from '../services/portal.service';

export function useFolderFiles(folderId) {
  const [files,   setFiles]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFolderFiles(folderId);
      setFiles(data || []);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('access_denied');
      } else {
        setError(err.response?.data?.message || err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { files, loading, error, refetch: fetch };
}
