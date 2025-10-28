import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Projects from './pages/Projects';
import Invoices from './pages/Invoices';
import Finance from './pages/Finance';
import Developers from './pages/Developers';
import Packages from './pages/Packages';
import SPK from './pages/SPK';
import Leads from './pages/Leads';
import Settings from './pages/Settings';
import AdsReport from './pages/AdsReport';
import NotFound from './pages/NotFound';
import Profile from './pages/Profile'; // Import Profile (Halaman baru)
import Index from './pages/Index';
import { Toaster } from "@/components/ui/toaster";
import { RoleGuard } from './components/layout/RoleGuard';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Memuat sesi...</div>;
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Rute publik */}
            <Route path="/auth" element={<AuthPage />} />
            
            {/* Rute Index (redirector) */}
            <Route path="/" element={<Index />} /> 

            {/* Rute yang dilindungi */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} /> 
            <Route path="/clients" element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'cs']}><Clients /></RoleGuard></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'cs', 'developer']}><Projects /></RoleGuard></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'cs', 'finance']}><Invoices /></RoleGuard></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'finance']}><Finance /></RoleGuard></ProtectedRoute>} />
            <Route path="/developers" element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'finance', 'developer']}><Developers /></RoleGuard></ProtectedRoute>} />
            <Route path="/packages" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><Packages /></RoleGuard></ProtectedRoute>} />
            <Route path="/spk" element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'cs']}><SPK /></RoleGuard></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'cs']}><Leads /></RoleGuard></ProtectedRoute>} />
            <Route path="/ads-report" element={<ProtectedRoute><RoleGuard allowedRoles={['admin', 'finance']}><AdsReport /></RoleGuard></ProtectedRoute>} />
            
            {/* Halaman Settings kini hanya untuk Admin */}
            <Route path="/settings" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><Settings /></RoleGuard></ProtectedRoute>} />
            
            {/* Halaman Profile untuk SEMUA role yang login */}
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            
            {/* Rute Not Found */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
