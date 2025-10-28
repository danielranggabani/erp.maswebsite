import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export type UserRole = 'admin' | 'cs' | 'developer' | 'finance';

export const useRoles = () => {
  const { user } = useAuth();

  const { data: roles, isLoading } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;
      return data.map(r => r.role as UserRole);
    },
    enabled: !!user?.id,
  });

  const hasRole = (role: UserRole) => {
    return roles?.includes(role) || false;
  };

  const isAdmin = hasRole('admin');
  const isCS = hasRole('cs');
  const isDeveloper = hasRole('developer');
  const isFinance = hasRole('finance');

  return {
    roles: roles || [],
    isLoading,
    hasRole,
    isAdmin,
    isCS,
    isDeveloper,
    isFinance,
  };
};
