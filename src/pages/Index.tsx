import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Building2, Loader2 } from 'lucide-react'; // Import Loader2

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // --- UBAH REDIRECT DI SINI ---
        navigate('/dashboard', { replace: true }); 
        // -----------------------------
      } else {
        navigate('/auth', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  // Tampilkan loading indicator saat memeriksa sesi
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Building2 className="w-12 h-12 text-primary mb-4" />
      <div className="flex items-center space-x-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> 
          <span>Memeriksa sesi...</span>
      </div>
    </div>
  );
}