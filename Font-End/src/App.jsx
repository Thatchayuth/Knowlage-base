import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'

// Public pages
import HomePage      from './pages/HomePage'
import KnowledgePage from './pages/KnowledgePage'
import SearchPage    from './pages/SearchPage'

// Auth
import AdminLoginPage from './pages/AdminLoginPage'

// Admin pages
import AdminDashboard       from './pages/admin/AdminDashboard'
import AdminLevel1Page      from './pages/admin/AdminLevel1Page'
import AdminLevel2Page      from './pages/admin/AdminLevel2Page'
import AdminKnowledgePage   from './pages/admin/AdminKnowledgePage'
import Level1FormPage       from './pages/admin/Level1FormPage'
import Level2FormPage       from './pages/admin/Level2FormPage'
import KnowledgeFormPage    from './pages/admin/KnowledgeFormPage'

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
            {/* Public routes */}
            <Route path="/"             element={<HomePage />} />
            <Route path="/knowledge/:id" element={<KnowledgePage />} />
            <Route path="/search"       element={<SearchPage />} />

            {/* Auth */}
            <Route path="/admin-login" element={<AdminLoginPage />} />

            {/* Protected admin routes */}
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
