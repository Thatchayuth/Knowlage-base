/**
 * FolderPortalPage.jsx
 * ────────────────────
 * Root page of the File Portal.
 * Route: /portal
 *
 * Renders inside the existing PublicLayout (same sidebar as IFAQ).
 * Main content shows root-level folders as grid cards.
 *
 * Flow:
 *   Mount → useFolderTree() → GET /api/portal/folders/tree
 *   User clicks folder card → navigate to /portal/:id
 */

import { useNavigate } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import { useFolderTree } from '../hooks/useFolderTree';
import FolderTree     from '../components/portal/FolderTree';
import FolderCard     from '../components/portal/FolderCard';

export default function FolderPortalPage() {
  const navigate = useNavigate();
  const { tree, loading, error } = useFolderTree();

  const handleSelect = (folder) => {
    navigate(`/portal/${folder.Id}`);
  };

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl text-brand-ink">📁 File Portal</h1>
          <p className="text-sm text-steel-500 mt-1 font-mono">โฟลเดอร์ที่คุณมีสิทธิ์เข้าถึง</p>
        </div>

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <div className="panel p-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && tree.length === 0 && (
          <div className="panel p-16 text-center">
            <span className="text-5xl">📂</span>
            <p className="mt-4 text-steel-500">ไม่พบโฟลเดอร์ที่คุณมีสิทธิ์เข้าถึง</p>
          </div>
        )}

        {!loading && !error && tree.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {tree.map(folder => (
              <FolderCard
                key={folder.Id}
                folder={folder}
                onClick={handleSelect}
              />
            ))}
          </div>
        )}

        {/* Tree navigator (collapsible) */}
        {!loading && !error && tree.length > 0 && (
          <div className="mt-10 panel p-4">
            <p className="text-xs font-mono text-steel-500 uppercase tracking-widest mb-3">Folder Structure</p>
            <FolderTree nodes={tree} selectedId={null} onSelect={handleSelect} />
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
