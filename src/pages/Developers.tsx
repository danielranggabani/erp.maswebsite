// src/pages/Developers.tsx

import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, DollarSign, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database, user_role, FinanceInsert, Finance } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';
import { useRoles } from '@/hooks/useRoles';
import { useEffect, useState } from 'react';

// --- TIPE DATA ---
type Profile = Database['public']['Tables']['profiles']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type PaymentRow = Database['public']['Tables']['developer_payments_tracking']['Row'];

interface DeveloperStats extends Profile {
    role: user_role;
    active_projects_count: number;
    completed_projects_count: number;
    pending_fee: number;          // Fee dari proyek aktif
    unpaid_balance: number;       // Saldo terutang: Earned - Paid
    total_lifetime_paid: number;  // Total riwayat pembayaran (dari finances)
    payment_records: PaymentRow[]; // Riwayat earned (dari tracking)
}

// --- UTILITY: FORMATTING ---
const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) return 'Rp 0';
    const numAmount = Number(amount);
    // Tampilkan apa adanya, termasuk negatif jika perhitungan salah
    // if (numAmount < 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(numAmount);
};

// --- DATA FETCHING (Logika Perhitungan Diperbaiki) ---
const useDeveloperStats = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { roles, isLoading: rolesLoading } = useRoles();

    // Pastikan user dan roles sudah siap
    const isQueryEnabled = !!user && !rolesLoading;

    // Fungsi helper keterangan (konsisten dengan mutasi)
    const generatePaymentKeterangan = (devName: string): string => {
        // Buat lebih unik dengan ID user jika perlu, tapi coba pakai nama dulu
        // Format ini HARUS SAMA PERSIS dengan yang digunakan saat filter
        return `Bayar fee ${devName}`; // Hapus (Ref:...) untuk sementara agar lebih simpel
    };

    return useQuery<
        { developers: DeveloperStats[], totals: { pending: number, unpaid: number, paid: number } },
        Error
    >({
        queryKey: ['developer-stats', user?.id, roles.join(',')],
        queryFn: async () => {
            try {
                if (!isQueryEnabled) { // Tambahan cek eksplisit
                    return { developers: [], totals: { pending: 0, unpaid: 0, paid: 0 } };
                }
                const currentUser = user!;
                const isFullAccess = roles.includes('admin') || roles.includes('finance');

                // 1. Dapatkan ID Developer yang relevan
                let developerIds: string[] = [];
                if (isFullAccess) {
                    const { data: roleData, error: roleError } = await supabase.from('user_roles').select('user_id').eq('role', 'developer');
                    if (roleError) throw new Error(`Role Error: ${roleError.message}`);
                    developerIds = roleData.map(r => r.user_id);
                } else if (roles.includes('developer')) {
                    developerIds = [currentUser.id];
                }
                if (developerIds.length === 0) return { developers: [], totals: { pending: 0, unpaid: 0, paid: 0 } };

                // 2. Fetch data (Profiles, All Projects, Tracking Payments, Gaji Finances)
                const [profilesRes, projectsRes, paymentsRes, financesRes] = await Promise.all([
                    supabase.from('profiles').select('id, full_name, avatar_url').in('id', developerIds),
                    supabase.from('projects').select('id, developer_id, fee_developer, status').in('developer_id', developerIds),
                    supabase.from('developer_payments_tracking').select('id, developer_id, amount_paid, paid_at, project_id').in('developer_id', developerIds),
                    supabase.from('finances').select('id, nominal, keterangan, tanggal').eq('kategori', 'gaji')
                ]);

                // Handle errors
                if (profilesRes.error) throw new Error(`Profil Error: ${profilesRes.error.message}`);
                if (projectsRes.error) throw new Error(`Project Error: ${projectsRes.error.message}`);
                if (paymentsRes.error) throw new Error(`Tracking Error: ${paymentsRes.error.message}`);
                if (financesRes.error) throw new Error(`Finances Error: ${financesRes.error.message}`);

                const profiles = profilesRes.data || [];
                const allProjects = projectsRes.data || [];
                const allPayments = paymentsRes.data || [];
                const allFinancesGaji = financesRes.data || [];

                // 3. Calculate Stats
                let totalPendingOverall = 0, totalUnpaidOverall = 0, totalPaidOverall = 0;
                const developerStatsPromises = profiles.map(async (profile) => {
                    // Filter data per dev
                    const devAllProjects = allProjects.filter(p => p.developer_id === profile.id);
                    const devPayments = allPayments.filter(p => p.developer_id === profile.id);

                    // (A) Pending: Filter proyek status != 'selesai'
                    const devActiveProjects = devAllProjects.filter(p => p.status !== 'selesai');
                    const pendingFee = devActiveProjects.reduce((sum, p) => sum + Number(p.fee_developer || 0), 0);

                    // (B) Total Earned: SUM dari tracking
                    const totalLifetimeEarned = devPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

                    // (C) Total Paid: SUM dari finances 'gaji' dengan keterangan COCOK PERSIS
                    const expectedKeterangan = generatePaymentKeterangan(profile.full_name); // Keterangan yg dicari
                    const devPaidExpenses = allFinancesGaji.filter(
                        // **FILTER KETAT: COCOK PERSIS** (atau startsWith jika lebih fleksibel)
                        f => f.keterangan === expectedKeterangan
                        // f => f.keterangan && f.keterangan.startsWith(expectedKeterangan) // Alternatif jika ada tambahan info
                    );
                    const totalLifetimePaid = devPaidExpenses.reduce((sum, f) => sum + Number(f.nominal || 0), 0);

                    // (D) Unpaid Balance
                    let unpaidBalance = totalLifetimeEarned - totalLifetimePaid;

                    // --- Logging Detail ---
                    console.log(`\n--- ${profile.full_name} ---`);
                    console.log(`  [A] Pending: ${formatCurrency(pendingFee)} (${devActiveProjects.length} proyek)`);
                    console.log(`  [B] Total Earned (Tracking): ${formatCurrency(totalLifetimeEarned)} (${devPayments.length} record)`);
                    // console.log(`      Detail Earned:`, devPayments.map(p=>({amount: p.amount_paid})));
                    console.log(`  [*] Mencari Finance 'gaji' dengan ket: "${expectedKeterangan}"`);
                    console.log(`  [C] Total Paid (Finances): ${formatCurrency(totalLifetimePaid)} (${devPaidExpenses.length} record cocok)`);
                    console.log(`      Detail Paid Cocok:`, devPaidExpenses.map(f=>({amount: f.nominal, ket: f.keterangan})));
                    console.log(`  [D] Unpaid Balance (B - C): ${formatCurrency(unpaidBalance)}`);
                    console.log(`--- Selesai ${profile.full_name} ---`);
                    // --- End Logging ---

                    const { data: roleInfo } = await supabase.from('user_roles').select('role').eq('user_id', profile.id).limit(1).single();

                    return {
                        ...profile, role: roleInfo?.role ?? 'developer' as user_role,
                        active_projects_count: devActiveProjects.length,
                        completed_projects_count: devPayments.length, // Jumlah proyek selesai = jml record tracking
                        pending_fee: pendingFee,
                        unpaid_balance: unpaidBalance,
                        total_lifetime_paid: totalLifetimePaid,
                        payment_records: devPayments,
                    } as DeveloperStats;
                });

                const developerStats = await Promise.all(developerStatsPromises);
                developerStats.forEach(dev => {
                    totalPendingOverall += dev.pending_fee;
                    totalUnpaidOverall += Math.max(0, dev.unpaid_balance); // Hanya jumlahkan saldo positif
                    totalPaidOverall += dev.total_lifetime_paid;
                });
                console.log("\n[useDeveloperStats] Totals:", { pending: formatCurrency(totalPendingOverall), unpaid: formatCurrency(totalUnpaidOverall), paid: formatCurrency(totalPaidOverall) });
                console.log("=========================================");
                return {
                    developers: developerStats.sort((a, b) => (b.unpaid_balance ?? 0) - (a.unpaid_balance ?? 0)),
                    totals: { pending: totalPendingOverall, unpaid: totalUnpaidOverall, paid: totalPaidOverall }
                };
            } catch (error: any) {
                console.error("[useDeveloperStats QueryFn] CAUGHT ERROR:", error);
                toast({ title: 'Error Fetch Data Dev', description: error.message, variant: 'destructive', duration: 10000 });
                return { developers: [], totals: { pending: 0, unpaid: 0, paid: 0 } }; // Return default on error
            }
        },
        enabled: isQueryEnabled,
        staleTime: 30 * 1000,
        retry: false, // Jangan retry jika error dari Supabase
        onError: (error: Error) => { // Tangani error global query jika perlu (meski sudah ada di queryFn)
            console.error("[useDeveloperStats Hook] Global Query onError:", error);
            // toast tidak perlu di sini jika sudah ada di queryFn catch
        }
    });
};
// ===================================================================

// --- MUTASI PEMBAYARAN (Gunakan Keterangan Simpel) ---
const usePaymentMutations = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Fungsi helper keterangan (konsisten dengan query)
    const generatePaymentKeterangan = (devName: string): string => {
        // **GUNAKAN FORMAT SIMPEL YANG SAMA DENGAN FILTER DI ATAS**
        return `Bayar fee ${devName}`;
    };

     const recordPaymentExpenseMutation = useMutation({
        mutationFn: async ({ developerId, developerName, totalAmountToPay }: { developerId: string; developerName: string; totalAmountToPay: number; }) => { // Hapus paymentRecordIds
            if (totalAmountToPay <= 0) throw new Error("Jumlah pembayaran harus lebih dari 0.");
            const currentUserId = (await supabase.auth.getUser())?.data.user?.id;
            if (!currentUserId) throw new Error("User tidak terautentikasi.");

            const financeData: FinanceInsert = {
                tipe: 'expense', kategori: 'gaji', nominal: totalAmountToPay,
                tanggal: new Date().toISOString().split('T')[0],
                keterangan: generatePaymentKeterangan(developerName), // Gunakan helper
                created_by: currentUserId,
            };
             console.log("[Mutasi Bayar] Mencatat expense:", financeData);
            const { error: financeError } = await supabase.from('finances').insert(financeData);
            if (financeError) throw financeError;
        },
        onSuccess: (data, variables) => {
            console.log("[Mutasi Bayar] Sukses.");
            // Invalidate query utama developer stats agar refresh
            queryClient.invalidateQueries({ queryKey: ['developer-stats'] });
            // Invalidate query lain yang relevan
            queryClient.invalidateQueries({ queryKey: ['finances'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            queryClient.invalidateQueries({ queryKey: ['developer-stats-dashboard'] });
            toast({ title: 'Sukses', description: `Expense fee ${variables.developerName} (${formatCurrency(variables.totalAmountToPay)}) tercatat.` });
        },
        onError: (error: any) => {
            console.error("[Mutasi Bayar] Gagal:", error);
            toast({ title: 'Error Catat Expense', description: `Gagal: ${error.message}.`, variant: 'destructive' });
        }
    });

     return { recordPaymentExpenseMutation };
}
// ===================================================================

// --- KOMPONEN UTAMA ---
export default function Developers() {
    // Ambil hooks
    const { data, isLoading: isLoadingStats, error: queryError, isFetching } = useDeveloperStats(); // Tambahkan isFetching
    const { recordPaymentExpenseMutation } = usePaymentMutations();
    const { roles, isLoading: rolesLoading } = useRoles();
    const { toast } = useToast();
    const [developerToPay, setDeveloperToPay] = useState<DeveloperStats | null>(null);

    // Ambil data dari hasil query
    const developerStats = data?.developers ?? [];
    const totals = data?.totals ?? { pending: 0, unpaid: 0, paid: 0 };

    const isFullAccess = !rolesLoading && (roles.includes('admin') || roles.includes('finance'));
    // Kombinasikan isLoading dan isFetching untuk indikator loading
    const isLoading = (isLoadingStats || rolesLoading || isFetching);

    // **PENTING: Handle Error DULU sebelum render utama**
    if (queryError && !isLoadingStats) { // Tampilkan error jika query gagal setelah loading awal
       return ( <DashboardLayout><div className="container p-6 text-center"><AlertCircle className="h-12 w-12 text-destructive mx-auto"/><h1 className="text-2xl font-bold">Error Memuat Data</h1><p>{queryError.message}</p></div></DashboardLayout>);
    }

    // --- Render View (Developer / Admin) ---
    // Developer View
    if (!isFullAccess && developerStats.length === 1 && !isLoading) { // Tampilkan jika loading selesai
        const dev = developerStats[0];
        return ( <DashboardLayout> {/* ... UI Developer View ... */} </DashboardLayout> );
    } else if (!isFullAccess && developerStats.length === 0 && !isLoading) { // Tampilkan jika loading selesai
        return ( <DashboardLayout> {/* ... UI No Data ... */} </DashboardLayout> );
    }

    // Admin/Finance View
    const confirmPayment = (developer: DeveloperStats) => {
        const unpaidAmount = developer.unpaid_balance;
        if (unpaidAmount <= 0) {
            toast({ title: "Info", description: `Tidak ada saldo terutang untuk ${developer.full_name}.` });
            return;
        }
        setDeveloperToPay(developer);
    };
    const executePayment = () => {
        if (!developerToPay) return;
        const totalAmountToPay = developerToPay.unpaid_balance;
        if (totalAmountToPay <= 0) {
            toast({title: "Info", description: "Jumlah pembayaran nol.", variant: "default"});
            setDeveloperToPay(null);
            return;
        }
        // Tidak perlu paymentRecordIds lagi
        recordPaymentExpenseMutation.mutate({ developerId: developerToPay.id, developerName: developerToPay.full_name, totalAmountToPay: totalAmountToPay },
         { onSettled: () => setDeveloperToPay(null) }
        );
    };

    // Tampilkan loading jika masih loading
    if (isLoading) {
        return <DashboardLayout><div className="flex justify-center items-center h-screen"><p>Memuat data developer...</p></div></DashboardLayout>;
    }

    // Render Admin/Finance View jika loading selesai
    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                {/* ... Header & Card Total ... */}
                 <div className="flex items-center justify-between"> <div className="flex items-center gap-2"><Users className="h-8 w-8" /><h1 className="text-3xl font-bold">Pembayaran Developer</h1></div></div>
                <p className="text-muted-foreground">Ringkasan komisi dan status pembayaran.</p>
                 <div className="grid gap-4 md:grid-cols-4">
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Dev</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{developerStats.length}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Pending</CardTitle><Clock className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-xl font-bold text-orange-600">{formatCurrency(totals.pending)}</div><p className="text-xs text-muted-foreground">Proyek aktif.</p></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Saldo Terutang</CardTitle><DollarSign className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-xl font-bold text-blue-600">{formatCurrency(totals.unpaid)}</div><p className="text-xs text-muted-foreground">Belum dibayar.</p></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Telah Dibayar</CardTitle><CheckCircle className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(totals.paid)}</div><p className="text-xs text-muted-foreground">Tercatat di Keuangan.</p></CardContent></Card>
                </div>
                {/* Tabel Rincian */}
                <Card>
                    <CardHeader><CardTitle>Rincian Fee per Developer</CardTitle></CardHeader>
                     <CardContent className="p-0 pt-4">
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Developer</TableHead>
                                        <TableHead>Pending (Aktif)</TableHead>
                                        <TableHead>Saldo Terutang</TableHead>
                                        <TableHead>Total Dibayar</TableHead>
                                        <TableHead className='text-right'>Aksi Catat Bayar</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {developerStats.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada developer.</TableCell></TableRow>
                                    ) : (
                                        developerStats.map(dev => {
                                            const unpaidAmount = dev.unpaid_balance;
                                            const canPay = unpaidAmount > 0;
                                            // Cek isPending TANPA perlu developerToPay karena hanya ada 1 mutasi
                                            const isPayingThisDev = recordPaymentExpenseMutation.isPending && developerToPay?.id === dev.id;
                                            return (
                                                <TableRow key={dev.id}>
                                                    <TableCell>{dev.full_name}</TableCell>
                                                    <TableCell>{formatCurrency(dev.pending_fee)}</TableCell>
                                                    <TableCell className={`font-semibold ${unpaidAmount > 0 ? 'text-blue-600' : (unpaidAmount < 0 ? 'text-red-600' : 'text-gray-500')}`}>
                                                        {formatCurrency(unpaidAmount)}
                                                        {unpaidAmount < 0 && <span className="text-xs"> (Overpaid?)</span>}
                                                    </TableCell>
                                                    <TableCell>{formatCurrency(dev.total_lifetime_paid)}</TableCell>
                                                    <TableCell className='text-right'>
                                                         <Button variant="default" size="sm" onClick={() => confirmPayment(dev)} disabled={!canPay || isPayingThisDev} title={!canPay ? "Tidak ada saldo terutang" : `Catat Pembayaran ${formatCurrency(unpaidAmount)}`} >
                                                             {isPayingThisDev ? 'Mencatat...' : `Catat Bayar (${formatCurrency(unpaidAmount)})`}
                                                         </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                 {/* ... Info Cards ... */}
                 <Card className='border-blue-500 bg-blue-50 mt-4'>
                         <CardHeader className='flex-row items-center gap-2'><AlertCircle className='w-5 h-5'/><CardTitle>Alur Kerja Pembayaran</CardTitle></CardHeader>
                         <CardContent className='text-sm space-y-1'>
                            <p>1. Proyek **ditugaskan**: Fee muncul di **Pending**.</p>
                            <p>2. Proyek **selesai**: Fee pindah ke `developer_payments_tracking` (menambah Total Earned).</p>
                            <p>3. Halaman ini menghitung: **Saldo Terutang** = (Total Earned) - (Total dibayar di `finances` kategori 'gaji' dengan format keterangan "Bayar fee NAMA").</p>
                            <p>4. Tombol **"Catat Bayar"** membuat entri expense sejumlah **Saldo Terutang** saat ini.</p>
                            <p>5. Setelah dicatat & data refresh, **Saldo Terutang** akan kembali ke 0.</p>
                         </CardContent>
                     </Card>

                {/* AlertDialog */}
                 <AlertDialog open={!!developerToPay} onOpenChange={() => setDeveloperToPay(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Pencatatan Expense</AlertDialogTitle>
                        <AlertDialogDescription>
                            Anda akan mencatat expense sejumlah <span className="font-bold">{formatCurrency(developerToPay?.unpaid_balance)}</span> untuk <span className="font-bold">{developerToPay?.full_name}</span>.
                            Jumlah ini adalah total saldo terutang saat ini. Lanjutkan?
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executePayment}
                            disabled={recordPaymentExpenseMutation.isPending} // Cek isPending langsung
                        >
                            {recordPaymentExpenseMutation.isPending ? 'Mencatat...' : 'Ya, Catat Expense'}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </DashboardLayout>
    );
}