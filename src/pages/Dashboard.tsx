// src/pages/Dashboard.tsx
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useRoles, UserRole } from '@/hooks/useRoles';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign, FolderKanban, Users, UsersRound, TrendingUp, AlertTriangle, Loader2, ListOrdered, BarChart3, LineChart as LineChartIcon, PieChart, Activity, UserCog, PackageSearch, FileText, FilePlus, UserPlus as UserPlusIcon, TrendingUp as TrendingUpIcon, FileDown,
    Briefcase, ListTodo, CircleDollarSign, CheckCircle // Icons for Developer Dashboard
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, Line, LineChart, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Cell, Sector, CartesianGrid } from 'recharts';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, getYear, getMonth, isValid, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import React, { useState, useMemo } from 'react';
import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

// --- Tipe Data Spesifik Dashboard ---
type Finance = Database['public']['Tables']['finances']['Row'];
type Invoice = Database['public']['Tables']['invoices']['Row'];
type Project = Database['public']['Tables']['projects']['Row'] & {
    clients: { nama: string } | null; // Join client name
};
type ProjectStatus = Database['public']['Enums']['project_status'];
type Client = Database['public']['Tables']['clients']['Row'];
type UserProfile = Database['public']['Tables']['profiles']['Row'];
type DeveloperPayment = Database['public']['Tables']['developer_payments_tracking']['Row'];
type ActivityLog = Database['public']['Tables']['activity_logs']['Row'] & { user_name?: string }; // Tambahkan user_name opsional
type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert'];
type AdsReport = Database['public']['Tables']['ads_reports']['Row'];
type TopDeveloper = {
    id: string;
    name: string;
    value: number;
};
type DeveloperDashboardData = {
    summary: {
        totalProyek: number;
        totalProyekAktif: number;
        feePending: number;
        feeDibayar: number;
    };
    projects: Project[]; // Daftar proyek developer
};

// --- Helper & Konstanta ---
const formatCurrency = (amount: number | null | undefined, digits = 0): string => {
    if (amount == null || isNaN(Number(amount))) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(amount));
};
const formatROAS = (value: number | null | undefined): string => {
    if (value == null || isNaN(Number(value)) || value === 0) return '-';
    return `${Number(value).toFixed(2)}x`;
};
const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(0, i), 'MMMM', { locale: id }));
const CURRENT_YEAR = getYear(new Date());
const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Helper status badge
const statusColors: Record<ProjectStatus, string> = {
    briefing: 'bg-gray-400',
    desain: 'bg-blue-500',
    development: 'bg-yellow-500',
    revisi: 'bg-orange-500',
    selesai: 'bg-green-500',
    launch: 'bg-purple-500',
};
const getStatusBadge = (status: ProjectStatus | null) => {
    const safeStatus = status || 'briefing';
    const displayStatus = safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1);
    return <Badge className={`${statusColors[safeStatus] || 'bg-gray-500'} text-white`}>{displayStatus}</Badge>;
};

// --- Hooks Data Dashboard (Gabungan Admin & Developer) ---
const useDashboardData = (selectedYear: number) => {
    const { user } = useAuth();
    const { roles } = useRoles();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const developerId = user?.id;

    const yearStart = format(new Date(selectedYear, 0, 1), 'yyyy-MM-dd');
    const yearEnd = format(new Date(selectedYear, 11, 31), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const queryResult = useQuery({
        queryKey: ['dashboardData', selectedYear, user?.id, roles.join('-')],
        queryFn: async () => {
            if (!user) return null;

            // --- INISIALISASI VARIABEL PENTING DI SCOPE TRY TERTINGGI ---
            let headerStats = { totalRevenueThisMonth: 0, totalActiveProjects: 0, totalClients: 0, totalDevelopers: 0, averageRoasThisMonth: 0 };
            let monthlyFinanceData: { month: string; Pendapatan: number; Pengeluaran: number; 'Laba Bersih': number; }[] = MONTHS.map(m => ({ month: m.substring(0,3), Pendapatan: 0, Pengeluaran: 0, 'Laba Bersih': 0})); // Initialize to array of months
            let projectStatusChartData: { name: string; value: number; }[] = [];
            let topDevelopersData: TopDeveloper[] = [];
            let recentActivities: ActivityLog[] = [];
            let developerFeeSummary = { pendingFee: 0, paidFeeThisMonth: 0 };
            let adsSummary = { totalAdsRevenueYear: 0, totalAdsSpendYear: 0, averageRoasYear: 0, totalAdsProfitYear: 0, totalAdsLeadsYear: 0 };
            let roasTrendData: { date: string; ROAS: number; }[] = [];
            let developerSpecificData: DeveloperDashboardData | null = null;
            // -------------------------------------------------------------

            try {
                // Fetch semua data yang dibutuhkan secara paralel
                const [
                    financeIncomeThisMonthRes,
                    activeProjectsRes,
                    totalClientsRes,
                    totalDevelopersRes,
                    adsReportsThisMonthRes,
                    financeMonthlyRes,
                    projectStatusRes,
                    activityLogsRes,
                    developerFeesRes,
                    adsReportsAllYearRes,
                    completedProjectsRes,
                    allProfilesRes,
                    developerProjectsRes,
                    developerPaymentsRes
                ] = await Promise.all([
                    // 1. Header Cards (Logika Sederhana)
                    supabase.from('finances').select('nominal', { count: 'exact'}).eq('tipe', 'income').gte('tanggal', monthStart).lte('tanggal', monthEnd),
                    supabase.from('projects').select('id', { count: 'exact', head: true }).not('status', 'eq', 'selesai'),
                    supabase.from('clients').select('id', { count: 'exact', head: true }),
                    supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'developer'),
                    supabase.from('ads_reports').select('roas').gte('report_date', monthStart).lte('report_date', monthEnd),

                    // 2. Grafik Keuangan (Ambil semua data setahun)
                    supabase.from('finances').select('tanggal, tipe, nominal').gte('tanggal', yearStart).lte('tanggal', yearEnd),

                    // 3. Grafik Proyek (Ambil semua status)
                    supabase.from('projects').select('status'),

                    // 4. Aktivitas Terbaru
                    supabase.from('activity_logs').select('id, user_id, action, created_at').order('created_at', { ascending: false }).limit(10),

                    // 5. Ringkasan Fee Developer
                    Promise.all([
                        supabase.from('projects').select('fee_developer').not('status', 'in', '("selesai","launch")').not('developer_id', 'is', null), // Pending
                        supabase.from('finances').select('nominal').eq('kategori', 'gaji').gte('tanggal', monthStart).lte('tanggal', monthEnd) // Paid this month
                    ]),

                    // 6. Ringkasan Iklan
                    supabase.from('ads_reports').select('revenue, ads_spend, profit_loss, leads, report_date, roas').gte('report_date', yearStart).lte('report_date', yearEnd),

                    // Query untuk Top Developer
                    supabase.from('projects').select('developer_id').eq('status', 'selesai').not('developer_id', 'is', null), // Proyek selesai
                    supabase.from('profiles').select('id, full_name'), // Semua profiles
                    
                    // Developer Specific Data (Query)
                    developerId ? supabase.from('projects').select('*, clients(nama)').eq('developer_id', developerId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as Project[], error: null }),
                    developerId ? supabase.from('developer_payments_tracking').select('amount_paid').eq('developer_id', developerId) : Promise.resolve({ data: [] as DeveloperPayment[], error: null }),
                ]);

                // --- Handle Errors ---
                const errors = [
                    { name: 'Finance Income (Month)', error: financeIncomeThisMonthRes.error },
                    { name: 'Active Projects Count', error: activeProjectsRes.error },
                    { name: 'Total Clients Count', error: totalClientsRes.error },
                    { name: 'Total Developers Count', error: totalDevelopersRes.error },
                    { name: 'Ads ROAS (Month)', error: adsReportsThisMonthRes.error },
                    { name: 'Finances (Year)', error: financeMonthlyRes.error },
                    { name: 'Project Statuses', error: projectStatusRes.error },
                    { name: 'Activity Logs', error: activityLogsRes.error },
                    { name: 'Pending Dev Fees', error: developerFeesRes[0].error },
                    { name: 'Paid Dev Fees (Month)', error: developerFeesRes[1].error },
                    { name: 'Ads Reports (Year)', error: adsReportsAllYearRes.error },
                    { name: 'Completed Projects (Top Dev)', error: completedProjectsRes.error },
                    { name: 'All Profiles', error: allProfilesRes.error },
                    { name: 'Developer Projects', error: developerProjectsRes.error },
                    { name: 'Developer Payments', error: developerPaymentsRes.error },
                ];

                let hasAuthError = false;
                errors.forEach(result => {
                    if (result.error) {
                        console.error(`Error fetching ${result.name}:`, result.error);
                        if (result.error.message === 'JWT expired' || (result.error as any).code === 'PGRST301' || (result.error as any).status === 401) {
                           hasAuthError = true;
                        } else {
                            toast({ title: `Error: ${result.name}`, description: result.error.message, variant: "destructive" });
                        }
                    }
                });

                if (hasAuthError) {
                     console.warn("Authentication error detected (JWT expired or RLS issue).")
                     toast({ title: "Sesi Bermasalah", description: "Gagal mengambil data. Sesi Anda mungkin telah berakhir atau akses dibatasi. Coba login ulang.", variant: "destructive" });
                     return null;
                }

                // --- Proses Data ---

                const profilesMap = new Map((allProfilesRes.data ?? [])?.map(p => [p.id, p.full_name]) ?? []);

                // 1. Header Cards (Assign to scoped variable)
                headerStats.totalRevenueThisMonth = financeIncomeThisMonthRes.data?.reduce((sum, item) => sum + Number(item.nominal || 0), 0) ?? 0;
                headerStats.totalActiveProjects = activeProjectsRes.count ?? 0;
                headerStats.totalClients = totalClientsRes.count ?? 0;
                headerStats.totalDevelopers = totalDevelopersRes.count ?? 0;
                const roasDataThisMonth = adsReportsThisMonthRes.data?.map(r => Number(r.roas)).filter(r => !isNaN(r) && r > 0) ?? [];
                headerStats.averageRoasThisMonth = roasDataThisMonth.length > 0 ? roasDataThisMonth.reduce((a, b) => a + b, 0) / roasDataThisMonth.length : 0;

                // 2. Grafik Keuangan (Reassign to scoped variable)
                const financeData = financeMonthlyRes.data || [];
                monthlyFinanceData = MONTHS.map((monthName, index) => { // Line 215 where the crash was happening
                    const monthNum = index;
                    const monthData = financeData.filter(f => {
                         try {
                            if (!f.tanggal) return false;
                            const date = parseISO(f.tanggal);
                            return isValid(date) && getMonth(date) === monthNum && getYear(date) === selectedYear;
                         } catch (e) { return false; }
                    });
                    const income = monthData.filter(f => f.tipe === 'income').reduce((sum, f) => sum + Number(f.nominal), 0);
                    const expense = monthData.filter(f => f.tipe === 'expense').reduce((sum, f) => sum + Number(f.nominal), 0);
                    const netProfit = income - expense;
                    return { month: monthName.substring(0, 3), Pendapatan: income, Pengeluaran: expense, 'Laba Bersih': netProfit };
                });

                // 3. Grafik Proyek (Reassign to scoped variable)
                const projectStatusData = projectStatusRes.data || [];
                const projectStatusCounts: { [key: string]: number } = {};
                projectStatusData.forEach(p => {
                    const status = p.status || 'unknown';
                    projectStatusCounts[status] = (projectStatusCounts[status] || 0) + 1;
                });
                projectStatusChartData = Object.entries(projectStatusCounts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

                // Kalkulasi Top Developer
                const completedProjectsData = completedProjectsRes.data || [];
                const completedProjectCounts: { [developerId: string]: number } = {};
                completedProjectsData.forEach(p => {
                    if (p.developer_id) {
                        completedProjectCounts[p.developer_id] = (completedProjectCounts[p.developer_id] || 0) + 1;
                    }
                });
                topDevelopersData = Object.entries(completedProjectCounts)
                    .map(([developerId, count]) => ({
                        id: developerId,
                        name: profilesMap.get(developerId) || `User (${developerId.slice(-4)})`,
                        value: count,
                    }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);

                // 4. Aktivitas Terbaru
                recentActivities = (activityLogsRes.data || []).map(log => ({
                    ...log,
                    user_name: log.user_id ? profilesMap.get(log.user_id) : 'Sistem'
                }));

                // 5. Ringkasan Fee Developer
                const pendingFee = developerFeesRes[0].data?.reduce((sum, p) => sum + Number(p.fee_developer || 0), 0) ?? 0;
                const paidFeeThisMonth = developerFeesRes[1].data?.reduce((sum, f) => sum + Number(f.nominal || 0), 0) ?? 0;
                developerFeeSummary = { pendingFee, paidFeeThisMonth };

                // 6. Ringkasan Iklan
                const adsYearData = adsReportsAllYearRes.data || [];
                const totalAdsRevenueYear = adsYearData.reduce((sum, r) => sum + Number(r.revenue || 0), 0);
                const totalAdsSpendYear = adsYearData.reduce((sum, r) => sum + Number(r.ads_spend || 0), 0);
                const totalAdsProfitYear = adsYearData.reduce((sum, r) => sum + Number(r.profit_loss || 0), 0);
                const totalAdsLeadsYear = adsYearData.reduce((sum, r) => sum + Number(r.leads || 0), 0);
                const averageRoasYear = totalAdsSpendYear > 0 ? totalAdsRevenueYear / totalAdsSpendYear : 0;
                adsSummary = { totalAdsRevenueYear, totalAdsSpendYear, averageRoasYear, totalAdsProfitYear, totalAdsLeadsYear };

                roasTrendData = adsYearData
                    .filter(r => r.report_date && isValid(parseISO(r.report_date)))
                    .sort((a,b) => parseISO(a.report_date!).getTime() - parseISO(b.report_date!).getTime())
                    .map(r => ({
                        date: format(parseISO(r.report_date!), 'dd/MM'),
                        ROAS: r.roas ?? 0
                    }));

                // B. Proses Data Spesifik Developer
                if (developerId && developerProjectsRes.data) {
                    const devProjects = (developerProjectsRes.data as Project[]) || [];
                    const devPayments = (developerPaymentsRes.data as DeveloperPayment[]) || [];

                    const totalProyekDev = devProjects.length;
                    const proyekAktifDev = devProjects.filter(p => p.status !== 'selesai' && p.status !== 'launch');
                    const totalProyekAktifDev = proyekAktifDev.length;
                    const feePendingDev = proyekAktifDev.reduce((sum, p) => sum + Number(p.fee_developer || 0), 0);
                    const feeDibayarDev = devPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

                    developerSpecificData = {
                        summary: {
                            totalProyek: totalProyekDev,
                            totalProyekAktif: totalProyekAktifDev,
                            feePending: feePendingDev,
                            feeDibayar: feeDibayarDev,
                        },
                        projects: devProjects,
                    };
                }

                // Return semua data
                return {
                    headerStats,
                    financeChartData: monthlyFinanceData,
                    projectStatusChartData,
                    topDevelopersData,
                    recentActivities,
                    developerFeeSummary,
                    adsSummary,
                    roasTrendData,
                    developerSpecificData,
                };

            } catch (error: any) {
                console.error("Dashboard data fetching failed critically:", error);
                toast({
                    title: "Gagal Memuat Data Dashboard",
                    description: error.message || "Terjadi kesalahan fatal saat mengambil data.",
                    variant: "destructive",
                });
                return null;
            }
        },
        staleTime: 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
        retry: (failureCount, error: any) => {
            if (error.message === 'JWT expired' || (error as any).status === 401 || (error as any).code === 'PGRST301') {
                return false;
            }
            return failureCount < 1;
        },
    });

    // --- Mutasi untuk update status project (dari Developer view) ---
    const updateStatusMutation = useMutation({
        mutationFn: async ({ projectId, newStatus }: { projectId: string; newStatus: ProjectStatus }) => {
            if (!user) throw new Error("User tidak ditemukan");

            // 1. Update status
            const { error: updateError } = await supabase
                .from('projects')
                .update({ status: newStatus })
                .eq('id', projectId)
                .eq('developer_id', user.id); // Pastikan hanya bisa update proyek sendiri

            if (updateError) throw updateError;

            // 2. Log aktivitas
            const logEntry: ActivityLogInsert = {
                user_id: user.id,
                action: `Status proyek ${projectId.slice(-4)} diubah menjadi ${newStatus}`,
                entity_type: 'projects',
                entity_id: projectId,
            };
            const { error: logError } = await supabase.from('activity_logs').insert(logEntry);

            if (logError) {
                console.error("Gagal mencatat aktivitas:", logError);
                toast({ title: "Update Status Berhasil", description: "Namun gagal mencatat aktivitas.", variant: "default" });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dashboardData', selectedYear, user?.id, roles.join('-')] }); // Refresh data dashboard
            queryClient.invalidateQueries({ queryKey: ['projects']}); // Refresh data project global
            toast({ title: "Sukses", description: "Status proyek berhasil diperbarui." });
        },
        onError: (error: any) => {
            toast({ title: "Error Update Status", description: error.message, variant: "destructive" });
        },
    });
    // -------------------------------------------------------------

    return { ...queryResult, updateStatusMutation };
};


// --- Komponen Pie Chart Aktif ---
const ActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} fontWeight="bold" fontSize="14px">
                {payload.name}
            </text>
            <Sector
                cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius}
                startAngle={startAngle} endAngle={endAngle} fill={fill}
            />
            <Sector
                cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle}
                innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill}
            />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
            <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" fontSize="12px">{`${value} Proyek`}</text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" fontSize="11px">
                {`(Rate ${(percent * 100).toFixed(2)}%)`}
            </text>
        </g>
    );
};


// --- Komponen Utama Dashboard ---
export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { roles, isLoading: rolesLoading } = useRoles();
    const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
    const [activeIndex, setActiveIndex] = useState(0);

    const { data: dashboardData, isLoading, error: queryError, isError, updateStatusMutation } = useDashboardData(selectedYear);

    const onPieEnter = (_: any, index: number) => { setActiveIndex(index); };

    const isAdmin = roles.includes('admin');
    const isFinance = roles.includes('finance');
    const isCS = roles.includes('cs');
    const isDeveloper = roles.includes('developer');
    // Tentukan view mana yang ditampilkan
    const showDeveloperView = isDeveloper && !isAdmin && !isFinance && !isCS;

    // Handler untuk ubah status dari Developer view
    const developerStatusOptions: ProjectStatus[] = ['development', 'revisi', 'selesai'];
    const handleStatusChange = (projectId: string, currentStatus: ProjectStatus | null, newStatusValue: string) => {
        const newStatus = newStatusValue as ProjectStatus;

        if (!newStatus || !developerStatusOptions.includes(newStatus)) {
            return;
        }
        if (newStatus === currentStatus) return;

        updateStatusMutation.mutate({ projectId, newStatus });
    };

    if (isLoading || rolesLoading) {
        return (
            <DashboardLayout>
                <div className="flex min-h-[calc(100vh-theme(spacing.14))] items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    if ((isError && !dashboardData) || !user) {
         return (
             <DashboardLayout>
                <div className="container mx-auto p-6 space-y-4 text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                    <h2 className="text-2xl font-bold text-destructive">Gagal Memuat Data Dashboard</h2>
                    <p className="text-muted-foreground">{queryError?.message || "Tidak dapat memuat data pengguna atau dashboard. Sesi Anda mungkin telah berakhir atau akses ditolak oleh RLS. Silakan coba login ulang atau hubungi administrator."}</p>
                    {import.meta.env.DEV && queryError && <pre className="mt-4 text-xs text-left bg-muted p-2 rounded">{JSON.stringify(queryError, null, 2)}</pre>}
                </div>
            </DashboardLayout>
        )
    }

    const {
        headerStats, financeChartData, projectStatusChartData, topDevelopersData,
        recentActivities, developerFeeSummary, adsSummary, roasTrendData,
        developerSpecificData
    } = dashboardData || {
        headerStats: { totalRevenueThisMonth: 0, totalActiveProjects: 0, totalClients: 0, totalDevelopers: 0, averageRoasThisMonth: 0 },
        financeChartData: MONTHS.map(m => ({ month: m.substring(0,3), Pendapatan: 0, Pengeluaran: 0, 'Laba Bersih': 0})),
        projectStatusChartData: [],
        topDevelopersData: [],
        recentActivities: [],
        developerFeeSummary: { pendingFee: 0, paidFeeThisMonth: 0 },
        adsSummary: { totalAdsRevenueYear: 0, totalAdsSpendYear: 0, averageRoasYear: 0, totalAdsProfitYear: 0, totalAdsLeadsYear: 0 },
        roasTrendData: [],
        developerSpecificData: null,
    };

    const canViewFinance = isAdmin || isFinance;
    const canViewProjectsGeneral = isAdmin || isCS;
    const canViewDevelopersGeneral = isAdmin || isFinance;
    const canViewAds = isAdmin || isFinance;

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">

                {/* === TAMPILAN DASHBOARD DEVELOPER === */}
                {showDeveloperView && developerSpecificData && (
                    <>
                        <h2 className="text-3xl font-bold tracking-tight">Dashboard Developer</h2>
                        {/* A. Ringkasan Pribadi Developer */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Proyek Anda</CardTitle>
                                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent><div className="text-2xl font-bold">{developerSpecificData.summary.totalProyek}</div></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Proyek Aktif Anda</CardTitle>
                                    <ListTodo className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent><div className="text-2xl font-bold">{developerSpecificData.summary.totalProyekAktif}</div></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Fee Pending Anda</CardTitle>
                                    <CircleDollarSign className="h-4 w-4 text-orange-500" />
                                </CardHeader>
                                <CardContent><div className="text-2xl font-bold">{formatCurrency(developerSpecificData.summary.feePending)}</div></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Fee Diterima</CardTitle>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                </CardHeader>
                                <CardContent><div className="text-2xl font-bold">{formatCurrency(developerSpecificData.summary.feeDibayar)}</div></CardContent>
                            </Card>
                        </div>

                        {/* B. Daftar Proyek Developer */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Daftar Proyek Anda</CardTitle>
                                <CardDescription>Proyek yang ditugaskan kepada Anda.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nama Proyek</TableHead>
                                                <TableHead>Klien</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Deadline</TableHead>
                                                <TableHead className="w-[180px]">Ubah Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {developerSpecificData.projects.length === 0 ? (
                                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Belum ada proyek.</TableCell></TableRow>
                                            ) : (
                                                developerSpecificData.projects.map((project) => (
                                                    <TableRow key={project.id}>
                                                        <TableCell className="font-medium">{project.nama_proyek}</TableCell>
                                                        <TableCell>{project.clients?.nama || '-'}</TableCell>
                                                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                                                        <TableCell>{project.tanggal_selesai ? format(parseISO(project.tanggal_selesai), 'dd MMM yyyy', { locale: id }) : '-'}</TableCell>
                                                        <TableCell>
                                                            <Select
                                                                value={project.status || ''}
                                                                onValueChange={(newValue) => handleStatusChange(project.id, project.status, newValue)}
                                                                disabled={updateStatusMutation.isPending || project.status === 'selesai' || project.status === 'launch'}
                                                            >
                                                                <SelectTrigger disabled={project.status === 'selesai' || project.status === 'launch'}>
                                                                    <SelectValue placeholder="Ubah status..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {developerStatusOptions.map(statusOption => (
                                                                        <SelectItem key={statusOption} value={statusOption} disabled={project.status === 'selesai' || project.status === 'launch'}>
                                                                            {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {/* === TAMPILAN DASHBOARD ADMIN/FINANCE/CS (DEFAULT) === */}
                {!showDeveloperView && (
                     <>
                        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
                        {/* 1. Header Section */}
                        {isAdmin && (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Pendapatan (Bulan Ini)</CardTitle>
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent><div className="text-2xl font-bold">{headerStats.totalRevenueThisMonth}</div></CardContent>
                                </Card>
                                 <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Proyek Aktif</CardTitle>
                                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent><div className="text-2xl font-bold">{headerStats.totalActiveProjects}</div></CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Total Klien</CardTitle>
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent><div className="text-2xl font-bold">{headerStats.totalClients}</div></CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Total Developer</CardTitle>
                                        <UserCog className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent><div className="text-2xl font-bold">{headerStats.totalDevelopers}</div></CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">ROAS (Bulan Ini)</CardTitle>
                                        <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent><div className="text-2xl font-bold">{formatROAS(headerStats.averageRoasThisMonth)}</div></CardContent>
                                </Card>
                            </div>
                        )}
                        {!isAdmin && (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                 {canViewProjectsGeneral && <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Proyek Aktif</CardTitle><FolderKanban className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{headerStats.totalActiveProjects}</div></CardContent></Card>}
                            </div>
                        )}

                        {/* 2. Grafik Keuangan */}
                        {canViewFinance && (
                            <Card>
                                <CardHeader> <div className="flex justify-between items-center"> <CardTitle>Grafik Keuangan Tahun {selectedYear}</CardTitle> <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}> <SelectTrigger className="w-[120px]"> <SelectValue /> </SelectTrigger> <SelectContent> {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(year => ( <SelectItem key={year} value={year.toString()}>{year}</SelectItem> ))} </SelectContent> </Select> </div> </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-6">
                                    <div className="h-[300px]"> <CardDescription className="mb-2">Pendapatan vs Pengeluaran</CardDescription> <ResponsiveContainer width="100%" height="100%"> <BarChart data={financeChartData}> <CartesianGrid strokeDasharray="3 3" /> <XAxis dataKey="month" fontSize={12} /> <YAxis fontSize={12} tickFormatter={(value) => formatCurrency(value).replace('Rp', '')} /> <Tooltip formatter={(value: number) => formatCurrency(value)} /> <Legend wrapperStyle={{ fontSize: '12px' }}/> <Bar dataKey="Pendapatan" fill="#22c55e" radius={[4, 4, 0, 0]} /> <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} /> </BarChart> </ResponsiveContainer> </div>
                                    <div className="h-[300px]"> <CardDescription className="mb-2">Laba Bersih (Estimasi)</CardDescription> <ResponsiveContainer width="100%" height="100%"> <LineChart data={financeChartData}> <CartesianGrid strokeDasharray="3 3" /> <XAxis dataKey="month" fontSize={12}/> <YAxis fontSize={12} tickFormatter={(value) => formatCurrency(value).replace('Rp', '')} /> <Tooltip formatter={(value: number) => formatCurrency(value)} /> <Legend wrapperStyle={{ fontSize: '12px' }}/> <Line type="monotone" dataKey="Laba Bersih" stroke="#3b82f6" strokeWidth={2} dot={false} /> </LineChart> </ResponsiveContainer> </div>
                                </CardContent>
                            </Card>
                         )}

                        {/* 3. Grafik Proyek & Developer (Umum) */}
                        {canViewProjectsGeneral && (
                            <Card className="col-span-1 lg:col-span-2">
                                <CardHeader> <CardTitle>Overview Proyek</CardTitle> </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-6 items-center">
                                   <div className="h-[250px] flex flex-col items-center">
                                       <CardDescription className="mb-2 text-center">Distribusi Status Proyek</CardDescription>
                                       <ResponsiveContainer width="100%" height="100%">
                                           <RechartsPieChart>
                                               <Pie
                                                   activeIndex={activeIndex}
                                                   activeShape={ActiveShape}
                                                   data={projectStatusChartData}
                                                   cx="50%"
                                                   cy="50%"
                                                   innerRadius={60}
                                                   outerRadius={80}
                                                   fill="#8884d8"
                                                   dataKey="value"
                                                   onMouseEnter={onPieEnter}
                                                   paddingAngle={2}
                                               >
                                                   {projectStatusChartData.map((entry, index) => (
                                                       <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                   ))}
                                               </Pie>
                                           </RechartsPieChart>
                                        </ResponsiveContainer>
                                   </div>
                                    {isAdmin && ( // Top Dev hanya untuk Admin
                                        <div className="space-y-3">
                                            <CardDescription className="mb-2">Top Developer (by Proyek Selesai)</CardDescription>
                                            {topDevelopersData.length === 0 ? (
                                                 <p className="text-sm text-muted-foreground text-center py-4">Belum ada data proyek selesai.</p>
                                            ) : (
                                                <ul className="space-y-2">
                                                    {topDevelopersData.map((dev, index) => (
                                                        <li key={dev.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                                                            <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`} {dev.name}</span>
                                                            <span className="font-medium">{dev.value} proyek</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* 4. Aktivitas Terbaru (Hanya Admin) */}
                        {isAdmin && (
                            <Card>
                                <CardHeader> <CardTitle>Aktivitas Terbaru</CardTitle> </CardHeader>
                                <CardContent>
                                     <Table>
                                       <TableHeader>
                                           <TableRow>
                                               <TableHead>User</TableHead>
                                               <TableHead>Aksi</TableHead>
                                               <TableHead className='text-right'>Waktu</TableHead>
                                           </TableRow>
                                       </TableHeader>
                                        <TableBody>
                                            {recentActivities.length === 0 ? (
                                                <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Belum ada aktivitas.</TableCell></TableRow>
                                            ) : (
                                                recentActivities.map(log => (
                                                    <TableRow key={log.id}>
                                                        <TableCell>{log.user_name || (log.user_id ? `User (${log.user_id.slice(-4)})` : 'Sistem')}</TableCell>
                                                        <TableCell className='max-w-md truncate'>{log.action}</TableCell>
                                                        <TableCell className='text-right text-xs text-muted-foreground'>{format(new Date(log.created_at), 'dd MMM yyyy - HH:mm', { locale: id })}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {/* 5. Ringkasan Fee Developer (Umum) */}
                        {canViewDevelopersGeneral && (
                            <Card>
                               <CardHeader> <CardTitle>Ringkasan Fee Developer</CardTitle> </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-4">
                                    <div className="p-4 border rounded bg-orange-50 text-orange-700"> <p className="text-sm font-medium">Pending Fee</p> <p className="text-2xl font-bold">{formatCurrency(developerFeeSummary.pendingFee)}</p> <p className="text-xs">Total fee dari proyek aktif belum dibayar.</p> </div>
                                     <div className="p-4 border rounded bg-green-50 text-green-700"> <p className="text-sm font-medium">Fee Dibayar (Bulan Ini)</p> <p className="text-2xl font-bold">{formatCurrency(developerFeeSummary.paidFeeThisMonth)}</p> <p className="text-xs">Total fee yang tercatat di Keuangan bulan ini.</p> </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* 6. Ringkasan Iklan */}
                        {canViewAds && (
                             <Card>
                               <CardHeader> <CardTitle>Ringkasan Performa Iklan (Setahun)</CardTitle> </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid gap-4 md:grid-cols-5 text-sm">
                                        <div><Label>Total Revenue</Label><p className="text-lg font-bold">{formatCurrency(headerStats.totalRevenueThisMonth)}</p></div>
                                        <div><Label>Total Ads Spend</Label><p className="text-lg font-bold">{formatCurrency(adsSummary.totalAdsSpendYear)}</p></div>
                                        <div><Label>Avg. ROAS</Label><p className="text-lg font-bold">{formatROAS(adsSummary.averageRoasYear)}</p></div>
                                        <div><Label>Total Profit/Loss</Label><p className={`text-lg font-bold ${adsSummary.totalAdsProfitYear >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(adsSummary.totalAdsProfitYear)}</p></div>
                                        <div><Label>Total Leads</Label><p className="text-lg font-bold">{adsSummary.totalAdsLeadsYear.toLocaleString('id-ID')}</p></div>
                                    </div>
                                     <div className="h-[250px]"> <CardDescription className="mb-2">Tren ROAS (Setahun)</CardDescription> <ResponsiveContainer width="100%" height="100%"> <LineChart data={roasTrendData}> <CartesianGrid strokeDasharray="3 3" /> <XAxis dataKey="date" fontSize={10} interval="preserveStartEnd" tickCount={12}/> <YAxis fontSize={10} tickFormatter={(value) => formatROAS(value)} domain={['auto', 'auto']} /> <Tooltip formatter={(value: number) => formatROAS(value)} /> <Legend wrapperStyle={{ fontSize: '12px' }}/> <Line type="monotone" dataKey="ROAS" stroke="#8884d8" strokeWidth={2} dot={false} /> </LineChart> </ResponsiveContainer> </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* 7. Shortcut Aksi Cepat (Hanya Admin) */}
                        {isAdmin && (
                            <Card>
                                <CardHeader><CardTitle>Aksi Cepat</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                    <Button variant="outline" onClick={() => navigate('/projects')}> <FilePlus className="mr-2 h-4 w-4" /> Buat Proyek </Button>
                                    <Button variant="outline" onClick={() => navigate('/invoices')}> <FileText className="mr-2 h-4 w-4" /> Buat Invoice </Button>
                                    <Button variant="outline" onClick={() => navigate('/clients')}> <UserPlusIcon className="mr-2 h-4 w-4" /> Tambah Client </Button>
                                    <Button variant="outline" onClick={() => navigate('/ads-report')}> <TrendingUpIcon className="mr-2 h-4 w-4" /> Input Ads </Button>
                                    <Button variant="outline" onClick={() => navigate('/finance')}> <FileDown className="mr-2 h-4 w-4" /> Export Finance </Button>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}

            </div>
        </DashboardLayout>
    );
}