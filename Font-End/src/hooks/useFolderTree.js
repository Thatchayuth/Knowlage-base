/**
 * useFolderTree.js
 * ────────────────
 * React hook: fetch the root folder tree (permission-filtered for current user).
 * Used by FolderPortalPage and the sidebar FolderTree component.
 *
 * Returns: { tree, loading, error, refetch }
 * tree = nested array:
 *   [{ Id, FolderName, Icon, _hasDirectAccess, children:[...] }]
 */

import { useState, useEffect, useCallback } from 'react';
import { getFolderTree } from '../services/portal.service';

export function useFolderTree() {
  const [tree,    setTree]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFolderTree();
      setTree(data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { tree, loading, error, refetch: fetch };
}
