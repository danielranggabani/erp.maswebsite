import { useAuth } from '@/lib/auth';
import { useRoles, UserRole } from '@/hooks/useRoles';
import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

/**
 * Komponen pembungkus untuk melindungi rute berdasarkan peran (role).
 * Jika pengguna tidak memiliki peran yang diizinkan, akan dialihkan ke Dashboard.
 */
export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const { roles, isLoading: rolesLoading } = useRoles();

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Memuat otorisasi...</p>
      </div>
    );
  }

  // 1. Cek apakah pengguna sudah login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // 2. Cek apakah pengguna memiliki salah satu peran yang diizinkan
  const isAuthorized = allowedRoles.some(role => roles.includes(role));

  if (!isAuthorized) {
    // Pengguna tidak berhak, alihkan ke dashboard (atau halaman 403)
    return <Navigate to="/dashboard" replace />;
  }

  // Diizinkan
  return <>{children}</>;
}