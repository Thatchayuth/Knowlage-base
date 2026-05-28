import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'

// Public (login-gated) pages
import HomePage          from './pages/HomePage'
import KnowledgePage     from './pages/KnowledgePage'
import SearchPage        from './pages/SearchPage'
import PortalFilePage    from './pages/PortalFilePage'

// Auth
import AdminLoginPage from './pages/AdminLoginPage'

// Admin pages
import AdminDashboard         from './pages/admin/AdminDashboard'
import AdminLevel1Page        from './pages/admin/AdminLevel1Page'
import AdminLevel2Page        from './pages/admin/AdminLevel2Page'
import AdminKnowledgePage     from './pages/admin/AdminKnowledgePage'
import Level1FormPage         from './pages/admin/Level1FormPage'
import Level2FormPage         from './pages/admin/Level2FormPage'
import KnowledgeFormPage      from './pages/admin/KnowledgeFormPage'
import AdminFolderPage        from './pages/admin/AdminFolderPage'
import FolderFormPage         from './pages/admin/FolderFormPage'
import AdminPermissionsPage   from './pages/admin/AdminPermissionsPage'
import AdminSyncPage          from './pages/admin/AdminSyncPage'
import AdminSyncUsersPage    from './pages/admin/AdminSyncUsersPage'
import AdminSettingsPage     from './pages/admin/AdminSettingsPage'
import AdminTermsPage        from './pages/admin/AdminTermsPage'
import AdminHomePage         from './pages/admin/AdminHomePage'
import SyncUserPage          from './pages/SyncUserPage'

/** Requires user to be logged in (any role) */
function AuthRoute({ children }) {
  return (
    <ProtectedRoute requiredRole="user">
      {children}
    </ProtectedRoute>
  )
}

/** Requires admin role */
function AdminWrapper({ children }) {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* ── Login ── */}
            <Route path="/admin-login" element={<AdminLoginPage />} />

            {/* ── Public routes (login required) ── */}
            <Route path="/"              element={<AuthRoute><HomePage /></AuthRoute>} />
            <Route path="/knowledge/:id" element={<AuthRoute><KnowledgePage /></AuthRoute>} />
            <Route path="/search"        element={<AuthRoute><SearchPage /></AuthRoute>} />

            {/* File Portal viewer — no separate portal page */}
            <Route path="/portal/file/:fileId" element={<AuthRoute><PortalFilePage /></AuthRoute>} />
            {/* Redirect old portal paths to home */}
            <Route path="/portal"    element={<Navigate to="/" replace />} />
            <Route path="/portal/:id" element={<Navigate to="/" replace />} />

            {/* ── Admin routes ── */}
            <Route path="/administrator" element={
              <AdminWrapper><AdminDashboard /></AdminWrapper>
            } />
            <Route path="/administrator/level1" element={
              <AdminWrapper><AdminLevel1Page /></AdminWrapper>
            } />
            <Route path="/administrator/level1/new" element={
              <AdminWrapper><Level1FormPage /></AdminWrapper>
            } />
            <Route path="/administrator/level1/:id/edit" element={
              <AdminWrapper><Level1FormPage /></AdminWrapper>
            } />
            <Route path="/administrator/level2" element={
              <AdminWrapper><AdminLevel2Page /></AdminWrapper>
            } />
            <Route path="/administrator/level2/new" element={
              <AdminWrapper><Level2FormPage /></AdminWrapper>
            } />
            <Route path="/administrator/level2/:id/edit" element={
              <AdminWrapper><Level2FormPage /></AdminWrapper>
            } />
            <Route path="/administrator/knowledge" element={
              <AdminWrapper><AdminKnowledgePage /></AdminWrapper>
            } />
            <Route path="/administrator/knowledge/new" element={
              <AdminWrapper><KnowledgeFormPage /></AdminWrapper>
            } />
            <Route path="/administrator/knowledge/:id/edit" element={
              <AdminWrapper><KnowledgeFormPage /></AdminWrapper>
            } />

            {/* Portal admin routes */}
            <Route path="/administrator/portal/folders" element={
              <AdminWrapper><AdminFolderPage /></AdminWrapper>
            } />
            <Route path="/administrator/portal/folders/new" element={
              <AdminWrapper><FolderFormPage /></AdminWrapper>
            } />
            <Route path="/administrator/portal/folders/:id/edit" element={
              <AdminWrapper><FolderFormPage /></AdminWrapper>
            } />
            <Route path="/administrator/portal/permissions/:folderId" element={
              <AdminWrapper><AdminPermissionsPage /></AdminWrapper>
            } />
            <Route path="/administrator/portal/sync" element={
              <AdminWrapper><AdminSyncPage /></AdminWrapper>
            } />
            <Route path="/administrator/portal/sync-users" element={
              <AdminWrapper><AdminSyncUsersPage /></AdminWrapper>
            } />
            <Route path="/administrator/settings" element={
              <AdminWrapper><AdminSettingsPage /></AdminWrapper>
            } />
            <Route path="/administrator/terms" element={
              <AdminWrapper><AdminTermsPage /></AdminWrapper>
            } />
            <Route path="/administrator/home" element={
              <AdminWrapper><AdminHomePage /></AdminWrapper>
            } />

            {/* Sync User page */}
            <Route path="/sync" element={
              <ProtectedRoute requiredRole="syncuser">
                <SyncUserPage />
              </ProtectedRoute>
            } />

            {/* 404 */}
            <Route path="*" element={
              <div className="min-h-screen app-shell flex items-center justify-center">
                <div className="text-center">
                  <div className="font-display font-bold text-8xl text-steel-500 mb-4">404</div>
                  <p className="text-slate-400 mb-6">Page not found</p>
                  <a href="/" className="btn-primary">Go home</a>
                </div>
              </div>
            } />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
