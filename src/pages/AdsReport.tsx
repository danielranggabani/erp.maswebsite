// src/pages/AdsReport.tsx

import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit, Trash2, FileDown, Search, Loader2, AlertTriangle, LineChart, BarChart } from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';
import { useRoles } from '@/hooks/useRoles';
import { format, getISOWeek, getMonth, getYear } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ResponsiveContainer, LineChart as RechartsLineChart, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, Bar } from 'recharts';

// --- Tipe Data ---
type AdsReport = Database['public']['Tables']['ads_reports']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];
// --- [MODIFIKASI] Tambahkan Tipe FinanceInsert ---
type FinanceInsert = Database['public']['Tables']['finances']['Insert'];
// -------------------------------------------------

type AdsReportInput = Pick<
    AdsReport,
    'report_date' | 'revenue' | 'fee_payment' | 'ads_spend' | 'leads' | 'total_purchase'
> & { net_revenue: number; week: number | null; month: string | null; created_by?: string | null };


// --- Helper Functions (Sama) ---
const formatCurrency = (amount: number | null | undefined, digits = 0): string => {
    if (amount == null || isNaN(Number(amount))) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(amount));
};
const formatPercent = (value: number | null | undefined): string => {
    if (value == null || isNaN(Number(value))) return '-';
    return `${Number(value).toFixed(2)}%`;
};
const formatROAS = (value: number | null | undefined): string => {
    if (value == null || isNaN(Number(value))) return '-';
    return `${Number(value).toFixed(2)}x`;
};
const getWeekAndMonth = (dateString: string | Date): { week: number | null; month: string | null } => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.warn("Invalid date provided:", dateString);
            return { week: null, month: null };
        }
        const week = getISOWeek(date);
        const month = format(date, 'MMMM yyyy', { locale: id });
        return { week, month };
    } catch (e) {
        console.error("Error parsing date:", dateString, e);
        return { week: null, month: null };
    }
};

// --- Initial Form Data (Sama) ---
const initialFormData: Partial<AdsReportInput> = {
    report_date: format(new Date(), 'yyyy-MM-dd'),
    revenue: 0,
    fee_payment: 0,
    ads_spend: 0,
    leads: 0,
    total_purchase: 0,
};

// --- Hooks Data & Mutasi (Refactored) ---
const useAdsReportData = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Fetch reports DAN company data (Sama)
    const { data: allData, isLoading, error } = useQuery({
        queryKey: ['adsReportPageData'],
        queryFn: async () => {
            const [reportsRes, companyRes] = await Promise.all([
                supabase
                    .from('ads_reports')
                    .select('*')
                    .order('report_date', { ascending: false }),
                supabase
                    .from('companies')
                    .select('*')
                    .limit(1)
                    .maybeSingle()
            ]);
            
            if (reportsRes.error) throw reportsRes.error;
            if (companyRes.error) throw companyRes.error;

            const reports = reportsRes.data.map(r => ({
                ...r,
                revenue: Number(r.revenue ?? 0),
                fee_payment: Number(r.fee_payment ?? 0),
                net_revenue: Number(r.net_revenue ?? 0),
                ads_spend: Number(r.ads_spend ?? 0),
                tax_11: r.tax_11 ? Number(r.tax_11) : null,
                profit_loss: r.profit_loss ? Number(r.profit_loss) : null,
                roas: r.roas ? Number(r.roas) : null,
                leads: Number(r.leads ?? 0),
                total_purchase: Number(r.total_purchase ?? 0),
                conv_percent: r.conv_percent ? Number(r.conv_percent) : null,
                cost_per_lead: r.cost_per_lead ? Number(r.cost_per_lead) : null,
                cost_per_purchase: r.cost_per_purchase ? Number(r.cost_per_purchase) : null,
                week: r.week ? Number(r.week) : null,
            })) as AdsReport[];
            
            return { reports, company: companyRes.data as Company | null };
        },
    });

    // Fungsi helper calculateAndPrepareData (Sama)
    const calculateAndPrepareData = (formData: Partial<AdsReportInput>): AdsReportInput | null => {
        if (!formData.report_date) {
            toast({ title: "Error", description: "Tanggal wajib diisi.", variant: "destructive" });
            return null;
        }
        const { week, month } = getWeekAndMonth(formData.report_date);
        if (week === null || month === null) {
            toast({ title: "Error", description: "Format tanggal tidak valid.", variant: "destructive" });
            return null;
        }

        const revenue = Number(formData.revenue || 0);
        const fee_payment = Number(formData.fee_payment || 0);
        const ads_spend = Number(formData.ads_spend || 0);
        const leads = Number(formData.leads || 0);
        const total_purchase = Number(formData.total_purchase || 0);
        const net_revenue = revenue - fee_payment;

        if (revenue < 0 || fee_payment < 0 || ads_spend < 0 || leads < 0 || total_purchase < 0) {
            toast({ title: "Error", description: "Nilai input tidak boleh negatif.", variant: "destructive" });
            return null;
        }

        const dataToSubmit: AdsReportInput = {
            report_date: formData.report_date,
            revenue: revenue,
            fee_payment: fee_payment,
            net_revenue: net_revenue,
            ads_spend: ads_spend,
            leads: leads,
            total_purchase: total_purchase,
            week: week,
            month: month,
            created_by: user?.id,
        };
        return dataToSubmit;
    }

    // --- [MODIFIKASI] createMutation (Untuk mencatat ke finance) ---
    const createMutation = useMutation({
        mutationFn: async (formData: Partial<AdsReportInput>) => {
            const preparedData = calculateAndPrepareData(formData);
            if (!preparedData) throw new Error("Data tidak valid.");

            // 1. Insert ke ads_reports
            const { error: adsError } = await supabase.from('ads_reports').insert(preparedData);
            
            if (adsError) {
                if (adsError.code === '23505' && adsError.message.includes('ads_reports_report_date_key')) {
                    throw new Error(`Data untuk tanggal ${preparedData.report_date} sudah ada.`);
                }
                throw adsError; // Lemparkan error jika gagal
            }

            // 2. Jika sukses DAN ads_spend > 0, insert ke finances
            if (preparedData.ads_spend > 0) {
                const financeData: FinanceInsert = {
                    tipe: 'expense',
                    kategori: 'iklan', // Asumsi kategori 'iklan' di tabel finances
                    nominal: preparedData.ads_spend,
                    keterangan: `Biaya Iklan (Meta Ads) tgl ${preparedData.report_date}`,
                    tanggal: preparedData.report_date, // Gunakan tanggal laporan
                    created_by: user?.id,
                };
                
                const { error: financeError } = await supabase.from('finances').insert(financeData);
                
                if (financeError) {
                    // Jika gagal insert ke finance, lemparkan error agar user tahu
                    console.error("Gagal mencatat ads_spend ke finances:", financeError);
                    throw new Error(`Laporan Iklan sukses, TAPI GAGAL mencatat biaya ke Keuangan: ${financeError.message}`);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adsReportPageData'] });
            // --- [MODIFIKASI] Invalidate query finances juga ---
            queryClient.invalidateQueries({ queryKey: ['finances'] }); 
            toast({ title: "Sukses", description: "Laporan iklan DAN biaya iklan berhasil ditambahkan." }); // Pesan sukses baru
        },
        onError: (error: any) => {
            // Error ini akan menangkap error dari ads_reports ATAU finances
            toast({ title: "Error Menyimpan", description: error.message, variant: "destructive" });
        },
    });

    // updateMutation (Sama, tidak ada sinkronisasi otomatis ke finance saat update)
    const updateMutation = useMutation({
        mutationFn: async ({ id, formData }: { id: string, formData: Partial<AdsReportInput> }) => {
            const preparedData = calculateAndPrepareData(formData);
            if (!preparedData) throw new Error("Data tidak valid.");
            const { created_by, ...updateData } = preparedData;
            const { error } = await supabase.from('ads_reports').update(updateData).eq('id', id);
            if (error) {
                if (error.code === '23505' && error.message.includes('ads_reports_report_date_key')) {
                    throw new Error(`Data untuk tanggal ${preparedData.report_date} sudah ada.`);
                }
                throw error;
            }
            // CATATAN: Update TIDAK otomatis mengubah data di finance
            // Ini memerlukan logika lebih kompleks (cari record lama, update/hapus)
            // Sesuai permintaan, hanya 'create' yang diotomatisasi.
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adsReportPageData'] });
            toast({ title: "Sukses", description: "Laporan iklan berhasil diperbarui." });
        },
        onError: (error: any) => {
            toast({ title: "Error Update", description: error.message, variant: "destructive" });
        },
    });

    // deleteMutation (Sama, tidak ada sinkronisasi otomatis ke finance saat delete)
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('ads_reports').delete().eq('id', id);
            if (error) throw error;
            // CATATAN: Delete TIDAK otomatis menghapus data di finance
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adsReportPageData'] });
            toast({ title: "Sukses", description: "Laporan iklan berhasil dihapus." });
        },
        onError: (error: any) => {
            toast({ title: "Error Hapus", description: error.message, variant: "destructive" });
        },
    });

    return { 
        reports: allData?.reports || [],
        company: allData?.company,
        isLoading, 
        error, 
        createMutation, 
        updateMutation, 
        deleteMutation 
    };
};
// ------------------------------------------

// --- Komponen Utama (Sama) ---
export default function AdsReport() {
    const { toast } = useToast();
    const { user } = useAuth();
    const { roles, isLoading: rolesLoading } = useRoles(); 
    
    const { reports, company, isLoading, error, createMutation, updateMutation, deleteMutation } = useAdsReportData();

    const queryClient = useQueryClient();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingReport, setEditingReport] = useState<AdsReport | null>(null);
    const [formData, setFormData] = useState<Partial<AdsReportInput>>(initialFormData);
    const [reportToDelete, setReportToDelete] = useState<AdsReport | null>(null);
    const [filterMonth, setFilterMonth] = useState<string>('all');
    const pdfRef = useRef<HTMLDivElement>(null);

    const canManage = useMemo(() => roles.includes('admin'), [roles]);
    const canView = useMemo(() => roles.includes('admin') || roles.includes('finance'), [roles]);

    useEffect(() => {
        if (!isDialogOpen) {
            setEditingReport(null);
            setFormData(initialFormData);
        }
    }, [isDialogOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage) {
            toast({ title: "Akses Ditolak", description: "Hanya Admin yang dapat menambah/mengedit data.", variant: "destructive" });
            return;
        };

        if (editingReport) {
            updateMutation.mutate({ id: editingReport.id, formData }, {
                onSuccess: () => setIsDialogOpen(false),
            });
        } else {
            createMutation.mutate(formData, {
                onSuccess: () => setIsDialogOpen(false),
            });
        }
    };

    const handleEdit = (report: AdsReport) => {
        if (!canManage) {
            toast({ title: "Akses Ditolak", description: "Hanya Admin yang dapat mengedit data.", variant: "destructive" });
            return;
        };
        setEditingReport(report);
        setFormData({
            report_date: report.report_date,
            revenue: report.revenue,
            fee_payment: report.fee_payment,
            ads_spend: report.ads_spend,
            leads: report.leads,
            total_purchase: report.total_purchase,
        });
        setIsDialogOpen(true);
    };

    const confirmDelete = (report: AdsReport) => {
        if (!canManage) {
            toast({ title: "Akses Ditolak", description: "Hanya Admin yang dapat menghapus data.", variant: "destructive" });
            return;
        }
        setReportToDelete(report);
    };

    const executeDelete = () => {
        if (reportToDelete && canManage) {
            deleteMutation.mutate(reportToDelete.id, {
                onSettled: () => setReportToDelete(null),
            });
        }
    };

    const availableMonths = useMemo(() => {
        const months = new Set(reports.map(r => r.month).filter(Boolean));
        return Array.from(months).sort((a, b) => {
             try {
                 const dateA = new Date(a!.split(" ")[1], ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].indexOf(a!.split(" ")[0]));
                 const dateB = new Date(b!.split(" ")[1], ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].indexOf(b!.split(" ")[0]));
                 if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
                 return dateB.getTime() - dateA.getTime();
             } catch (e) {
                 console.error("Error parsing month for sort:", a, b, e);
                 return 0;
             }
        });
    }, [reports]);

    const filteredReports = useMemo(() => {
        const sortedReports = [...reports].sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime());
        if (filterMonth === 'all') {
            return sortedReports;
        }
        return sortedReports.filter(r => r.month === filterMonth);
    }, [reports, filterMonth]);

    const chartData = useMemo(() => {
        return filteredReports.map(r => ({
                date: format(new Date(r.report_date), 'dd MMM', { locale: id }),
                Revenue: r.revenue ?? 0,
                'Ads Spend': r.ads_spend ?? 0,
                Profit: r.profit_loss ?? 0,
                ROAS: r.roas ?? 0,
                'Conv. Rate': r.conv_percent ?? 0,
            }));
    }, [filteredReports]);

    const summary = useMemo(() => {
        const count = filteredReports.length;
        if (count === 0) return { revenue: 0, net_revenue: 0, spend: 0, tax: 0, profit: 0, roas: 0, convRate: 0, leads: 0, purchase: 0, cpl: 0, cpp: 0 };

        const totalRevenue = filteredReports.reduce((sum, r) => sum + (r.revenue ?? 0), 0);
        const totalFee = filteredReports.reduce((sum, r) => sum + (r.fee_payment ?? 0), 0);
        const totalNetRevenue = filteredReports.reduce((sum, r) => sum + (r.net_revenue ?? 0), 0);
        const totalSpend = filteredReports.reduce((sum, r) => sum + (r.ads_spend ?? 0), 0);
        const totalTax = filteredReports.reduce((sum, r) => sum + (r.tax_11 ?? 0), 0);
        const totalProfit = filteredReports.reduce((sum, r) => sum + (r.profit_loss ?? 0), 0);
        const totalLeads = filteredReports.reduce((sum, r) => sum + (r.leads ?? 0), 0);
        const totalPurchase = filteredReports.reduce((sum, r) => sum + (r.total_purchase ?? 0), 0);
        const avgRoas = totalSpend === 0 ? 0 : totalRevenue / totalSpend;
        const avgConvRate = totalLeads === 0 ? 0 : (totalPurchase / totalLeads) * 100;
        const avgCpl = totalLeads === 0 ? 0 : totalSpend / totalLeads;
        const avgCpp = totalPurchase === 0 ? 0 : totalSpend / totalPurchase;

        return { revenue: totalRevenue, net_revenue: totalNetRevenue, spend: totalSpend, tax: totalTax, profit: totalProfit, roas: avgRoas, convRate: avgConvRate, leads: totalLeads, purchase: totalPurchase, cpl: avgCpl, cpp: avgCpp };
    }, [filteredReports]);


    // --- EXPORT FUNCTIONS (Sama) ---
    const handleExportExcel = () => {
        if (filteredReports.length === 0) {
            toast({ title: "Info", description: "Tidak ada data untuk diexport." });
            return;
        }
        const monthYear = filterMonth === 'all' ? 'SemuaData' : filterMonth.replace(' ', '_');
        const fileName = `AdsReport_${monthYear}.xlsx`;

        const exportData = filteredReports.map(r => ({
            Tanggal: r.report_date,
            Revenue: r.revenue,
            'Fee Payment': r.fee_payment,
            'Net Revenue': r.net_revenue,
            'Ads Spend': r.ads_spend,
            'Tax 11%': r.tax_11 ?? 0,
            'Profit/Loss': r.profit_loss ?? 0,
            ROAS: r.roas ?? 0,
            Leads: r.leads,
            'Total Purchase': r.total_purchase,
            'Conv %': r.conv_percent ?? 0,
            'Cost/Lead (Rp)': r.cost_per_lead ?? 0,
            'Cost/Purchase (Rp)': r.cost_per_purchase ?? 0,
            Minggu: r.week ?? '-',
            Bulan: r.month ?? '-',
        }));

        exportData.push({});
        exportData.push({
            Tanggal: 'TOTAL / AVG',
            Revenue: summary.revenue,
            'Fee Payment': filteredReports.reduce((sum, r) => sum + (r.fee_payment ?? 0), 0),
            'Net Revenue': summary.net_revenue,
            'Ads Spend': summary.spend,
            'Tax 11%': summary.tax,
            'Profit/Loss': summary.profit,
            ROAS: summary.roas,
            Leads: summary.leads,
            'Total Purchase': summary.purchase,
            'Conv %': summary.convRate,
            'Cost/Lead (Rp)': summary.cpl,
            'Cost/Purchase (Rp)': summary.cpp,
            Minggu: '-',
            Bulan: '-',
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.sheet_add_aoa(worksheet, [[`Laporan Iklan - ${filterMonth === 'all' ? 'Semua Periode' : filterMonth}`]], { origin: "A1" });
        worksheet['!cols'] = [ { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 15 } ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Ads Report");
        XLSX.writeFile(workbook, fileName);
        toast({ title: "Export Excel Berhasil", description: `${fileName} telah didownload.` });
    };

    const handleExportPdf = async () => {
         const pdfExportArea = pdfRef.current;
         if (!pdfExportArea || filteredReports.length === 0) {
             toast({ title: "Info", description: "Tidak ada data atau area PDF tidak ditemukan." });
             return;
         }
         const monthYear = filterMonth === 'all' ? 'SemuaData' : filterMonth.replace(' ', '_');
         const fileName = `AdsReport_${monthYear}.pdf`;
         toast({ title: "Export PDF", description: "Memproses PDF..." });
         try {
             pdfExportArea.style.position = 'fixed';
             pdfExportArea.style.left = '0';
             pdfExportArea.style.top = '0';
             pdfExportArea.style.zIndex = '9999';
             pdfExportArea.style.width = '1123px';
             window.scrollTo(0, 0);
             await new Promise(resolve => setTimeout(resolve, 300));

             const canvas = await html2canvas(pdfExportArea, {
                 scale: 2,
                 useCORS: true,
                 logging: false,
                 backgroundColor: '#ffffff',
                 ignoreElements: (el) => el.classList.contains('pdf-ignore')
             });

             pdfExportArea.style.position = 'absolute';
             pdfExportArea.style.left = '-9999px';
             pdfExportArea.style.top = '-9999px';

             const imgData = canvas.toDataURL('image/png');
             const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
             const pdfWidth = pdf.internal.pageSize.getWidth();
             const pdfHeight = pdf.internal.pageSize.getHeight();
             const margin = 10;
             const imgWidth = pdfWidth - (margin * 2);
             const imgHeight = (canvas.height * imgWidth) / canvas.width;
             let heightLeft = imgHeight;
             let position = margin;
             pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
             heightLeft -= (pdfHeight - (margin * 2));
             while (heightLeft > 0) {
                 position = heightLeft - imgHeight - margin;
                 pdf.addPage();
                 pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
                 heightLeft -= (pdfHeight - (margin * 2));
             }
             pdf.save(fileName);
             toast({ title: "Export PDF Berhasil", description: `${fileName} telah didownload.` });
         } catch (error) {
             console.error("PDF Export Error:", error);
             toast({ title: "Error Export PDF", description: "Gagal membuat file PDF.", variant: "destructive" });
             if (pdfExportArea) {
                  pdfExportArea.style.position = 'absolute';
                  pdfExportArea.style.left = '-9999px';
                  pdfExportArea.style.top = '-9999px';
             }
         }
    };
    // ------------------------------------------

    // --- ROLE GUARDING (Sama) ---
    if (rolesLoading) {
        return <DashboardLayout><div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> Memuat otorisasi...</div></DashboardLayout>;
    }
    if (!canView) {
        return <DashboardLayout><div className="container p-6 text-center text-red-600"><AlertTriangle className="mx-auto h-10 w-10 mb-2" /> Akses ditolak. Modul ini hanya untuk Admin dan Finance.</div></DashboardLayout>;
    }
    // ------------------------------------------

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                
                {/* Header & Tombol Aksi (Sama) */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                     <div>
                        <h2 className="text-3xl font-bold tracking-tight">Laporan Iklan (Meta Ads)</h2>
                        <p className="text-muted-foreground">Analisis performa iklan Facebook & Instagram.</p>
                    </div>
                    <div className="flex gap-2">
                        {canManage && (
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Input Data Harian</Button></DialogTrigger>
                                <DialogContent className="max-w-xl">
                                     <DialogHeader>
                                        <DialogTitle>{editingReport ? 'Edit Laporan Harian' : 'Input Laporan Harian'}</DialogTitle>
                                        <DialogDescription>Masukkan data performa iklan untuk satu hari. Biaya Iklan (Ads Spend) akan otomatis tercatat di Keuangan.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 py-4">
                                        <div className="space-y-2"> <Label htmlFor="report_date">Tanggal *</Label> <Input id="report_date" type="date" required value={formData.report_date || ''} onChange={(e) => setFormData({ ...formData, report_date: e.target.value })} /> </div>
                                        <div className="space-y-2"> <Label htmlFor="revenue">Revenue (Rp) *</Label> <Input id="revenue" type="number" required min="0" value={formData.revenue ?? 0} onChange={(e) => setFormData({ ...formData, revenue: Number(e.target.value) })} /> </div>
                                        <div className="space-y-2"> <Label htmlFor="fee_payment">Fee Payment (Rp)</Label> <Input id="fee_payment" type="number" min="0" value={formData.fee_payment ?? 0} onChange={(e) => setFormData({ ...formData, fee_payment: Number(e.target.value) })} /> </div>
                                        <div className="space-y-2"> <Label htmlFor="ads_spend">Ads Spend (Rp) *</Label> <Input id="ads_spend" type="number" required min="0" value={formData.ads_spend ?? 0} onChange={(e) => setFormData({ ...formData, ads_spend: Number(e.target.value) })} /> </div>
                                        <div className="space-y-2"> <Label htmlFor="leads">Leads *</Label> <Input id="leads" type="number" required min="0" step="1" value={formData.leads ?? 0} onChange={(e) => setFormData({ ...formData, leads: parseInt(e.target.value, 10) || 0 })} /> </div>
                                        <div className="space-y-2"> <Label htmlFor="total_purchase">Total Purchase *</Label> <Input id="total_purchase" type="number" required min="0" step="1" value={formData.total_purchase ?? 0} onChange={(e) => setFormData({ ...formData, total_purchase: parseInt(e.target.value, 10) || 0 })} /> </div>
                                         <DialogFooter className="col-span-2 mt-4">
                                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {editingReport ? 'Update Data' : 'Simpan Data'}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                        <Button variant="outline" onClick={handleExportExcel} disabled={isLoading || filteredReports.length === 0}><FileDown className="mr-2 h-4 w-4" /> Export Excel</Button>
                        <Button variant="outline" onClick={handleExportPdf} disabled={isLoading || filteredReports.length === 0}><FileDown className="mr-2 h-4 w-4" /> Export PDF</Button>
                    </div>
                </div>

                {/* Filter (Sama) */}
                 <div className="flex items-center gap-4">
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter Bulan..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Bulan</SelectItem>
                            {availableMonths.map(month => <SelectItem key={month} value={month!}>{month}</SelectItem>)}
                        </SelectContent>
                    </Select>
                 </div>

                 {/* Ringkasan (Sama) */}
                 <Card>
                    <CardHeader><CardTitle>Ringkasan Performa ({filterMonth === 'all' ? 'Semua Periode' : filterMonth})</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-4 lg:grid-cols-8 text-sm">
                         <div><Label>Total Revenue</Label><p className="text-lg font-bold">{formatCurrency(summary.revenue)}</p></div>
                         <div><Label>Total Net Revenue</Label><p className="text-lg font-bold">{formatCurrency(summary.net_revenue)}</p></div>
                         <div><Label>Total Ads Spend</Label><p className="text-lg font-bold">{formatCurrency(summary.spend)}</p></div>
                         <div><Label>Total Tax (11%)</Label><p className="text-lg font-bold">{formatCurrency(summary.tax)}</p></div>
                         <div><Label>Total Profit/Loss</Label><p className={`text-lg font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(summary.profit)}</p></div>
                         <div><Label>Avg. ROAS</Label><p className="text-lg font-bold">{formatROAS(summary.roas)}</p></div>
                         <div><Label>Total Leads</Label><p className="text-lg font-bold">{summary.leads.toLocaleString('id-ID')}</p></div>
                         <div><Label>Total Purchase</Label><p className="text-lg font-bold">{summary.purchase.toLocaleString('id-ID')}</p></div>
                         <div className="lg:col-start-6"><Label>Avg. Conv. Rate</Label><p className="text-lg font-bold">{formatPercent(summary.convRate)}</p></div>
                         <div><Label>Avg. Cost/Lead</Label><p className="text-lg font-bold">{formatCurrency(summary.cpl)}</p></div>
                         <div><Label>Avg. Cost/Purchase</Label><p className="text-lg font-bold">{formatCurrency(summary.cpp)}</p></div>
                    </CardContent>
                 </Card>

                 {/* Grafik (Sama) */}
                 <Card>
                    <CardHeader><CardTitle>Grafik Performa</CardTitle></CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                        <div className="h-[300px]">
                             <Label className="text-sm text-muted-foreground">Revenue vs Ads Spend vs Profit</Label>
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" fontSize={10} />
                                    <YAxis width={80} fontSize={10} tickFormatter={(val) => formatCurrency(val, 0)} />
                                    <Tooltip contentStyle={{ fontSize: '12px' }} formatter={(val: number) => formatCurrency(val, 0)} />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Line type="monotone" dataKey="Revenue" stroke="#22c55e" dot={false} strokeWidth={2}/>
                                    <Line type="monotone" dataKey="Ads Spend" stroke="#ef4444" dot={false} strokeWidth={2}/>
                                    <Line type="monotone" dataKey="Profit" stroke="#3b82f6" dot={false} strokeWidth={2}/>
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="h-[300px]">
                             <Label className="text-sm text-muted-foreground">ROAS & Conv. Rate</Label>
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" fontSize={10} />
                                    <YAxis yAxisId="left" width={50} fontSize={10} tickFormatter={(val) => formatROAS(val)} />
                                    <YAxis yAxisId="right" orientation="right" width={50} fontSize={10} tickFormatter={(val) => formatPercent(val)} />
                                    <Tooltip contentStyle={{ fontSize: '12px' }} formatter={(value: number, name: string) => name === 'ROAS' ? formatROAS(value) : formatPercent(value)} />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Line yAxisId="left" type="monotone" dataKey="ROAS" stroke="#8884d8" dot={false} strokeWidth={2}/>
                                    <Line yAxisId="right" type="monotone" dataKey="Conv. Rate" stroke="#82ca9d" dot={false} strokeWidth={2}/>
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                 </Card>

                {/* Tabel Data (Sama) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Data Laporan Harian</CardTitle>
                        <CardDescription>Detail performa iklan per hari.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /> Memuat data...</div>
                        ) : error ? (
                            <div className="text-red-600 text-center py-10"><AlertTriangle className="mx-auto h-6 w-6 mb-2"/>Error: {error.message}</div>
                        ) : (
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tanggal</TableHead>
                                            <TableHead>Revenue</TableHead>
                                            <TableHead>Fee</TableHead>
                                            <TableHead>Net Rev.</TableHead>
                                            <TableHead>Ad Spend</TableHead>
                                            <TableHead>Tax 11%</TableHead>
                                            <TableHead>Profit/Loss</TableHead>
                                            <TableHead>ROAS</TableHead>
                                            <TableHead>Leads</TableHead>
                                            <TableHead>Purchase</TableHead>
                                            <TableHead>Conv %</TableHead>
                                            <TableHead>CPL</TableHead>
                                            <TableHead>CPP</TableHead>
                                            {canManage && <TableHead className="text-right">Aksi</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredReports.length === 0 ? (
                                            <TableRow><TableCell colSpan={canManage ? 14 : 13} className="text-center h-24 text-muted-foreground">Tidak ada data laporan untuk periode ini.</TableCell></TableRow>
                                        ) : (
                                            filteredReports.map(report => (
                                                <TableRow key={report.id}>
                                                    <TableCell>{format(new Date(report.report_date), 'dd MMM yyyy', { locale: id })}</TableCell>
                                                    <TableCell>{formatCurrency(report.revenue)}</TableCell>
                                                    <TableCell>{formatCurrency(report.fee_payment)}</TableCell>
                                                    <TableCell>{formatCurrency(report.net_revenue)}</TableCell>
                                                    <TableCell>{formatCurrency(report.ads_spend)}</TableCell>
                                                    <TableCell>{formatCurrency(report.tax_11)}</TableCell>
                                                    <TableCell className={(report.profit_loss ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(report.profit_loss)}</TableCell>
                                                    <TableCell>{formatROAS(report.roas)}</TableCell>
                                                    <TableCell>{report.leads}</TableCell>
                                                    <TableCell>{report.total_purchase}</TableCell>
                                                    <TableCell>{formatPercent(report.conv_percent)}</TableCell>
                                                    <TableCell>{formatCurrency(report.cost_per_lead)}</TableCell>
                                                    <TableCell>{formatCurrency(report.cost_per_purchase)}</TableCell>
                                                    {canManage && (
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(report)} title="Edit"><Edit className="h-4 w-4" /></Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => confirmDelete(report)} title="Hapus"><Trash2 className="h-4 w-4" /></Button>
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Area PDF Export (Sama) */}
                <div ref={pdfRef} className="pdf-export-area absolute -left-[9999px] -top-[9999px] bg-white p-10 w-[1123px]">
                     {/* Header PDF */}
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <div className="flex items-center space-x-4">
                            {company?.logo_url && (
                                <img 
                                    src={company.logo_url} 
                                    alt="Logo Perusahaan" 
                                    className="w-16 h-16 object-contain" 
                                />
                            )}
                            <div>
                                <h1 className="text-2xl font-bold">{company?.nama || 'Nama Perusahaan'}</h1>
                                <p className="text-sm text-gray-600">{company?.alamat || 'Alamat Perusahaan'}</p>
                            </div>
                        </div>
                        <h2 className="text-xl font-semibold">Laporan Iklan - {filterMonth === 'all' ? 'Semua Periode' : filterMonth}</h2>
                    </div>

                     {/* Ringkasan PDF */}
                     <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
                         <div><Label>Total Revenue:</Label><p className="font-bold">{formatCurrency(summary.revenue)}</p></div>
                         <div><Label>Total Ads Spend:</Label><p className="font-bold">{formatCurrency(summary.spend)}</p></div>
                         <div><Label>Total Profit/Loss:</Label><p className={`font-bold ${summary.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(summary.profit)}</p></div>
                         <div><Label>Avg. ROAS:</Label><p className="font-bold">{formatROAS(summary.roas)}</p></div>
                         <div><Label>Total Leads:</Label><p className="font-bold">{summary.leads}</p></div>
                         <div><Label>Total Purchase:</Label><p className="font-bold">{summary.purchase}</p></div>
                         <div><Label>Avg. Conv. Rate:</Label><p className="font-bold">{formatPercent(summary.convRate)}</p></div>
                     </div>

                     {/* Tabel PDF */}
                     <Table className="text-xs">
                        <TableHeader>
                            <TableRow className="bg-gray-100">
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Revenue</TableHead>
                                <TableHead>Spend</TableHead>
                                <TableHead>Profit</TableHead>
                                <TableHead>ROAS</TableHead>
                                <TableHead>Leads</TableHead>
                                <TableHead>Purch</TableHead>
                                <TableHead>Conv%</TableHead>
                                <TableHead>CPL</TableHead>
                                <TableHead>CPP</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                             {filteredReports.map(report => (
                                 <TableRow key={`pdf-${report.id}`}>
                                     <TableCell>{format(new Date(report.report_date), 'dd/MM/yy')}</TableCell>
                                     <TableCell>{formatCurrency(report.revenue)}</TableCell>
                                     <TableCell>{formatCurrency(report.ads_spend)}</TableCell>
                                     <TableCell className={(report.profit_loss ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}>{formatCurrency(report.profit_loss)}</TableCell>
                                     <TableCell>{formatROAS(report.roas)}</TableCell>
                                     <TableCell>{report.leads}</TableCell>
                                     <TableCell>{report.total_purchase}</TableCell>
                                     <TableCell>{formatPercent(report.conv_percent)}</TableCell>
                                     <TableCell>{formatCurrency(report.cost_per_lead)}</TableCell>
                                     <TableCell>{formatCurrency(report.cost_per_purchase)}</TableCell>
                                 </TableRow>
                             ))}
                         </TableBody>
                     </Table>
                </div>

                 {/* AlertDialog Hapus (Sama) */}
                 <AlertDialog open={!!reportToDelete} onOpenChange={() => setReportToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Laporan Iklan?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Yakin hapus data laporan tanggal {reportToDelete ? format(new Date(reportToDelete.report_date), 'dd MMMM yyyy', { locale: id }) : ''}? Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={executeDelete}
                                disabled={deleteMutation.isPending}
                                className={buttonVariants({ variant: "destructive" })}
                            >
                                {deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus Data'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </DashboardLayout>
    );
}