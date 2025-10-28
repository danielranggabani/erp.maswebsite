// src/components/layout/AppSidebar.tsx
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, 
    Users,
    FolderKanban,
    FileText,
    UserPlus, // Ikon Leads
    Package,
    Settings,
    FileSignature, // SPK
    DollarSign,
    Code2, // Developers
    Megaphone, // Ikon Ads Report
    LogOut, // Ikon Logout
    User // Profile
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useRoles } from '@/hooks/useRoles';
import { cn } from '@/lib/utils';
// Impor komponen sidebar kustom Anda
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import type { user_role as UserRole } from '@/integrations/supabase/types';

// Komponen SidebarItem
interface SidebarItemProps {
    href: string;
    icon: React.ElementType;
    label: string;
    isActive: boolean;
}

function SidebarItem({ href, icon: Icon, label, isActive }: SidebarItemProps) {
    return (
        <NavLink 
            to={href}
            end={href === '/dashboard'} // Tambahkan 'end' hanya untuk rute dashboard
            className={({ isActive: navIsActive }) => 
                cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    (navIsActive || isActive) && "bg-muted text-primary font-medium" 
                )
            }
        >
            <Icon className="h-4 w-4" />
            <span className="truncate">{label}</span>
        </NavLink>
    );
}


// Definisikan item menu
const mainMenuItems: { title: string; url: string; icon: any; roles?: UserRole[] }[] = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'cs', 'finance', 'developer'] },
    { title: 'Clients', url: '/clients', icon: Users, roles: ['admin', 'cs'] },
    { title: 'Projects', url: '/projects', icon: FolderKanban, roles: ['admin', 'cs', 'developer'] },
    { title: 'Invoices', url: '/invoices', icon: FileText, roles: ['admin', 'cs', 'finance'] },
    { title: 'SPK', url: '/spk', icon: FileSignature, roles: ['admin', 'cs'] },
    { title: 'Finance', url: '/finance', icon: DollarSign, roles: ['admin', 'finance'] },
];
const teamItems: { title: string; url: string; icon: any; roles?: UserRole[] }[] = [
    { title: 'Developers', url: '/developers', icon: Code2, roles: ['admin', 'finance', 'developer'] },
];
const marketingItems: { title: string; url: string; icon: any; roles?: UserRole[] }[] = [
    { title: 'Leads', url: '/leads', icon: UserPlus, roles: ['admin', 'cs'] },
    { title: 'Ads Report', url: '/ads-report', icon: Megaphone, roles: ['admin', 'finance'] },
    { title: 'Packages', url: '/packages', icon: Package, roles: ['admin'] },
];
const settingsItems: { title: string; url: string; icon: any; roles?: UserRole[] }[] = [
    { title: 'Settings', url: '/settings', icon: Settings, roles: ['admin'] },
];


export function AppSidebar() {
    const { state } = useSidebar();
    const { user } = useAuth();
    const { roles, isLoading: rolesLoading } = useRoles();
    const collapsed = state === 'collapsed';
    const location = useLocation();

    const hasAccess = (allowedRoles: UserRole[] | undefined): boolean => {
        if (!allowedRoles) return true;
        if (rolesLoading) return false;
        return allowedRoles.some(role => roles.includes(role));
    };

    const filteredMainMenu = mainMenuItems.filter(item => hasAccess(item.roles));
    const filteredTeamItems = teamItems.filter(item => hasAccess(item.roles));
    const filteredMarketingItems = marketingItems.filter(item => hasAccess(item.roles));
    const filteredSettingsItems = settingsItems.filter(item => hasAccess(item.roles));

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/auth';
    };

    // Cek path aktif (lebih fleksibel)
    const isCurrent = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/'; 
        return location.pathname.startsWith(path);
    }

    return (
        <Sidebar collapsible="icon" className="print:hidden">
            {/* Header Logo */}
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 mb-2">
                <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
                    <Package className="h-6 w-6" />
                    <span>ERP Maswebsite</span>
                </Link>
            </div>

            <SidebarContent className="flex-1 overflow-y-auto">
                {/* Main Menu */}
                {filteredMainMenu.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {filteredMainMenu.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarItem
                                            href={item.url}
                                            icon={item.icon}
                                            label={item.title}
                                            isActive={isCurrent(item.url)}
                                        />
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {/* Team Management */}
                {filteredTeamItems.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Team Management</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {filteredTeamItems.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarItem
                                            href={item.url}
                                            icon={item.icon}
                                            label={item.title}
                                            isActive={isCurrent(item.url)}
                                        />
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                {/* Marketing */}
                {filteredMarketingItems.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Marketing & Sales</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {filteredMarketingItems.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarItem
                                            href={item.url}
                                            icon={item.icon}
                                            label={item.title}
                                            isActive={isCurrent(item.url)}
                                        />
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>
            
            {/* Settings & Logout */}
            <SidebarGroup className="mt-auto border-t">
                <SidebarGroupContent>
                    <SidebarMenu>
                        {/* Link Profil Pribadi (untuk semua role) */}
                        <SidebarMenuItem>
                            <SidebarItem
                                href="/profile"
                                icon={User}
                                label="Profil Saya"
                                isActive={isCurrent('/profile')}
                            />
                        </SidebarMenuItem>

                        {/* Link Settings Perusahaan (Admin Only) */}
                        {filteredSettingsItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarItem
                                    href={item.url}
                                    icon={item.icon}
                                    label={item.title}
                                    isActive={isCurrent(item.url)}
                                />
                            </SidebarMenuItem>
                        ))}

                        {/* Logout Button */}
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={handleLogout} className="w-full justify-start text-muted-foreground hover:text-destructive">
                                <LogOut className="h-4 w-4" />
                                {!collapsed && <span className="truncate">Logout</span>}
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>


            {/* User Info (Footer) */}
            {!collapsed && (
                <div className="p-4 border-t">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                            <span className="text-sm font-medium">{user?.email?.[0]?.toUpperCase() || '?'}</span>
                        </div>
                        <div className="text-sm overflow-hidden">
                            <div className="font-semibold truncate" title={user?.email || ''}>{user?.email || 'User Email'}</div>
                            {!rolesLoading && <div className="text-xs text-muted-foreground capitalize truncate">{roles.join(', ') || 'No Role'}</div>}
                            {rolesLoading && <div className="text-xs text-muted-foreground">Loading role...</div>}
                        </div>
                    </div>
                </div>
            )}
        </Sidebar>
    );
}