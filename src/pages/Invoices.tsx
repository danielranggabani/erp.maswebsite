// src/pages/Invoices.tsx

import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
    DialogDescription
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
import {
    PlusCircle,
    Search,
    Pencil,
    Trash2,
    Download,
    Calendar,
    DollarSign,
    ArrowRight,
    FileText
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import { generateUniqueNumber } from '@/lib/number-generator';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';

// IMPORT WA SERVICE HELPER
import { triggerFeePaidNotification } from '@/services/fonnte-service';

// ======================= TIPE DATA DENGAN JOIN =======================
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];
type FinanceInsert = Database['public']['Tables']['finances']['Insert'];

type Project = ProjectRow & { clients: { nama: string } | null };

type Invoice = Database['public']['Tables']['invoices']['Row'] & {
    projects: {
        nama_proyek: string,
        client_id: string,
        developer_id: string | null,
        fee_developer: number | null,
        clients: { nama: string, bisnis: string } | null
    } | null;
    clients: { nama: string, bisnis: string } | null;
};
// Perbaiki tipe InvoiceInsert agar sesuai dengan struktur tabel 'invoices' Anda
// Pastikan semua kolom yang dikirim di handleSubmit ada di sini dan tipenya benar
type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];

// ======================= UTILS =======================
const statusColors: Record<string, string> = {
    draft: 'bg-gray-400',
    menunggu_dp: 'bg-yellow-500',
    lunas_dp: 'bg-blue-500',
    menunggu_pelunasan: 'bg-orange-500',
    lunas: 'bg-green-500',
    overdue: 'bg-red-500',
    batal: 'bg-gray-700',
};

const getStatusBadge = (status: string | null) => {
    const safeStatus = status || 'draft';
    const statusDisplayMap: Record<string, string> = {
        draft: 'Draft',
        menunggu_dp: 'Menunggu DP',
        lunas_dp: 'DP Lunas',
        menunggu_pelunasan: 'Menunggu Pelunasan',
        lunas: 'Lunas',
        overdue: 'Overdue',
        batal: 'Batal',
    };
    const displayStatus = statusDisplayMap[safeStatus] || safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1);
    return <Badge className={`${statusColors[safeStatus] || 'bg-gray-500'} text-white`}>{displayStatus}</Badge>;
};

const formatCurrency = (amount: number | null | undefined) => { // Allow null/undefined input
    if (amount == null) return 'N/A'; // Handle null/undefined case gracefully
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
};


// --- KOMPONEN TEMPLATE INVOICE VIEW ---
interface InvoiceViewProps {
    invoice: Invoice;
    company: Company | null;
}

const InvoiceView = React.forwardRef<HTMLDivElement, InvoiceViewProps>(({ invoice, company }, ref) => {
    const total = invoice.amount || 0;
    const clientName = invoice.clients?.nama || 'Klien Tidak Tersedia';
    const clientBusiness = invoice.clients?.bisnis || 'Bisnis Umum';
    const projectName = invoice.projects?.nama_proyek || 'Proyek Umum';
    const companyName = company?.nama || 'Nama Perusahaan Anda';
    const companyAddress = company?.alamat || 'Alamat Perusahaan Anda';
    const companyAccount = company?.rekening || 'Informasi Rekening Anda';
    const logoUrl = company?.logo_url;
    const isLunas = invoice.status === 'lunas';
    const paidAmount = isLunas ? total : 0;
    const balanceDue = total - paidAmount;
    const items = [{ description: `Jasa Pembuatan Website: ${projectName}`, amount: total }];

    return (
        // Wrapper div dengan ref dan ID untuk html2canvas
        <div ref={ref} id={`invoice-${invoice.id}`} className="p-10 space-y-10 bg-white max-w-full">
            {/* Header */}
            <header className="flex justify-between items-center text-white p-10" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)' }}>
                <div className="flex items-center space-x-4">
                    {logoUrl && (
                        <img src={logoUrl} alt="Logo Perusahaan" className="w-16 h-16 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
                    )}
                    <div className="space-y-0.5">
                        <h2 className="text-2xl font-extrabold" style={{letterSpacing: '0.5px'}}>{companyName}</h2>
                        <p className="text-xs opacity-90" style={{margin: '2px 0'}}>{companyAddress}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-5xl font-black tracking-tight" style={{fontWeight: 800, letterSpacing: '-1px'}}>INVOICE</h1>
                    <p className="text-sm opacity-90 mt-1"># {invoice.invoice_number}</p>
                </div>
            </header>

            {/* Konten Utama */}
            <div className="px-10 py-10 space-y-10">
                {/* Info Penagihan & Tanggal */}
                <section className="flex justify-between mb-10 text-base">
                    <div className="space-y-2">
                        <p className="font-bold text-lg text-blue-900 border-b-2 border-blue-900/50 inline-block pb-1">Tagihan Kepada</p>
                        <p className="font-bold text-base mt-2">{clientName}</p>
                        <p className="text-sm text-gray-700">Bisnis: {clientBusiness}</p>
                        {/* Tambahkan alamat klien jika ada */}
                    </div>
                    <div className="space-y-2 text-right">
                        <p><strong>Invoice No:</strong> {invoice.invoice_number}</p>
                        <p><strong>Tanggal Terbit:</strong> {invoice.tanggal_terbit ? format(parseISO(invoice.tanggal_terbit), 'dd MMMM yyyy') : '-'}</p>
                        <p className={`font-bold text-lg ${invoice.status === 'overdue' ? 'text-red-700' : 'text-orange-600'}`}>
                            Jatuh Tempo: {invoice.jatuh_tempo ? format(parseISO(invoice.jatuh_tempo), 'dd MMMM yyyy') : '-'}
                        </p>
                    </div>
                </section>

                {/* Tabel Item */}
                <Table>
                    <TableHeader className="bg-gray-100"><TableRow>
                        <TableHead className="text-blue-900 font-bold text-base border-b-2 border-gray-300">Deskripsi Layanan</TableHead>
                        <TableHead className="text-blue-900 text-right w-[15%] font-bold text-base border-b-2 border-gray-300">Jumlah (IDR)</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index} className="odd:bg-white even:bg-gray-50 border-b border-gray-200 hover:bg-gray-100">
                                <TableCell className="text-base">{item.description}</TableCell>
                                <TableCell className="text-right text-base">{formatCurrency(item.amount)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter className="bg-gray-100 mt-4 border-t-2 border-gray-300"><TableRow>
                        <TableCell className="text-right font-bold text-lg text-blue-900 border-t-2 border-gray-300">TOTAL TAGIHAN</TableCell>
                        <TableCell className="text-right font-bold text-lg text-blue-900 border-t-2 border-gray-300">{formatCurrency(total)}</TableCell>
                    </TableRow></TableFooter>
                </Table>

                {/* Ringkasan Total */}
                <div className="flex justify-end mt-10">
                    <div className="w-1/2 border border-blue-600 rounded-lg overflow-hidden">
                        <div className="flex justify-between p-4 bg-gray-100 font-bold text-lg text-blue-900 border-b">
                            <span>Total Tagihan</span>
                            <span>{formatCurrency(total)}</span>
                        </div>
                        {isLunas && (
                            <div className="flex justify-between p-4 text-base text-green-700 border-b border-gray-300">
                                <span>Sudah Dibayar</span>
                                <span>{formatCurrency(paidAmount)}</span>
                            </div>
                        )}
                        <div className={`flex justify-between p-4 font-extrabold text-xl ${isLunas ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-700'}`}>
                            <span>SISA PEMBAYARAN</span>
                            <span>{formatCurrency(balanceDue)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="pt-10 border-t border-gray-300 mt-10">
                    <div className="mb-4">
                        <p className="font-bold text-blue-900 mb-1">Instruksi Pembayaran:</p>
                        <p className="text-base text-gray-700">{companyAccount}</p>
                    </div>
                    <div className="text-center mt-8 text-gray-500">
                        <p>Terima kasih telah mempercayakan proyek Anda kepada kami!</p>
                    </div>
                </footer>
            </div>
        </div>
    );
});
InvoiceView.displayName = 'InvoiceView';

// ======================= DATA FETCHING & MUTATION - MODIFIED =======================
const useInvoiceData = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: allData, isLoading } = useQuery({
        queryKey: ['invoice-page-data'],
        queryFn: async () => {
            const [invoicesRes, projectsRes, companyRes] = await Promise.all([
                supabase.from('invoices').select(`
                    *,
                    projects(nama_proyek, client_id, developer_id, fee_developer, clients(nama, bisnis))
                `).order('created_at', { ascending: false }),
                supabase.from('projects').select('id, nama_proyek, harga, client_id, developer_id, fee_developer, clients(nama)').not('status', 'eq', 'selesai'),
                supabase.from('companies').select('*').limit(1).maybeSingle(),
            ]);

            if (invoicesRes.error) throw invoicesRes.error;
            if (projectsRes.error) throw projectsRes.error;
            if (companyRes.error && companyRes.status !== 406) {
                 console.warn("Company fetch error:", companyRes.error.message);
            }

            const invoices = (invoicesRes.data || []).map(inv => {
                const projectData = inv.projects as {
                    nama_proyek: string;
                    client_id: string;
                    developer_id: string | null;
                    fee_developer: number | null;
                    clients: { nama: string; bisnis: string } | null;
                } | null;
                return {
                    ...inv,
                    projects: projectData,
                    clients: projectData?.clients,
                    amount: Number(inv.amount || 0)
                };
            }) as Invoice[];

            const projects = (projectsRes.data || []).map(p => ({
                ...p,
                harga: Number(p.harga || 0),
                fee_developer: p.fee_developer ? Number(p.fee_developer) : null,
                clients: p.clients as { nama: string } | null
            })) as Project[];

            return { invoices, projects, company: companyRes.data as Company | null };
        },
        onError: (error: any) => {
            toast({ title: 'Error Memuat Data', description: `Gagal mengambil data: ${error.message}`, variant: 'destructive'});
        }
    });

    const createMutation = useMutation({
        mutationFn: async (data: InvoiceInsert) => {
            if (!data.invoice_number) data.invoice_number = generateUniqueNumber('INV');
            const { error } = await supabase.from('invoices').insert(data);
            if (error) throw error; // Ini akan melempar error RLS jika terjadi
        },
        onSuccess: () => {
            toast({ title: 'Sukses', description: 'Invoice berhasil dibuat.' });
            queryClient.invalidateQueries({ queryKey: ['invoice-page-data'] });
        },
        onError: (error: any) => {
            // Tangkap error RLS di sini
            toast({ title: 'Error Membuat Invoice', description: `Gagal membuat invoice: ${error.message}`, variant: 'destructive' });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<Invoice> & { id: string }) => {
            const { projects, clients, ...updateData } = data;
            const { error } = await supabase.from('invoices').update(updateData).eq('id', data.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Sukses', description: 'Invoice berhasil diupdate.' });
            queryClient.invalidateQueries({ queryKey: ['invoice-page-data'] });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: `Gagal mengupdate invoice: ${error.message}`, variant: 'destructive' });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error: financeDeleteError } = await supabase.from('finances').delete().eq('invoice_id', id);
            if (financeDeleteError) console.error("Error deleting related finance record:", financeDeleteError);

            const { error } = await supabase.from('invoices').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Sukses', description: 'Invoice berhasil dihapus.' });
            queryClient.invalidateQueries({ queryKey: ['invoice-page-data'] });
            queryClient.invalidateQueries({ queryKey: ['finances'] });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: `Gagal menghapus invoice: ${error.message}`, variant: 'destructive' });
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, paid_at, amount, isLunasNow, projectDetails }: {
            id: string;
            status: string;
            paid_at: string | null;
            amount: number;
            isLunasNow: boolean;
            projectDetails: {
                developer_id: string | null;
                fee_developer: number | null;
                nama_proyek: string | null;
                client_id: string | null;
            } | null;
        }) => {

            const { error: invoiceError } = await supabase.from('invoices').update({ status, paid_at }).eq('id', id);
            if (invoiceError) throw invoiceError;

            if (isLunasNow) {
                await supabase.from('finances').delete().eq('invoice_id', id);
                const newFinance: FinanceInsert = {
                    tipe: 'income',
                    kategori: 'pendapatan',
                    nominal: amount,
                    tanggal: new Date().toISOString().split('T')[0],
                    keterangan: `Pemasukan Lunas Invoice #${id.substring(0, 8)} (${projectDetails?.nama_proyek || 'Proyek'})`,
                    invoice_id: id,
                    created_by: (await supabase.auth.getUser()).data.user?.id
                };
                const { error: financeError } = await supabase.from('finances').insert(newFinance);
                if (financeError) { console.error("Gagal membuat record finance otomatis:", financeError); }

                if (projectDetails?.developer_id && projectDetails?.fee_developer && projectDetails.fee_developer > 0) {
                     const { data: devProfile, error: profileError } = await supabase
                        .from('profiles').select('phone, full_name').eq('id', projectDetails.developer_id).single();

                    if (profileError) {
                        console.error("Gagal fetch profile dev untuk notif:", profileError);
                    } else if (devProfile?.phone) {
                         await triggerFeePaidNotification(
                            projectDetails.developer_id,
                            projectDetails.nama_proyek || 'Proyek Tidak Bernama',
                            Number(projectDetails.fee_developer),
                            toast
                        );
                    } else {
                         console.warn(`Developer ${devProfile?.full_name || projectDetails.developer_id} tidak punya nomor WA.`);
                         toast({ title: "Info", description: `Developer ${devProfile?.full_name} tidak memiliki nomor WA.`, variant: "default", duration: 7000 });
                    }
                } else {
                     console.log(`[Invoice Lunas] Tidak ada fee/dev untuk proyek ${projectDetails?.nama_proyek}`);
                }
            } else {
                const { error: deleteFinanceError } = await supabase.from('finances').delete().eq('invoice_id', id);
                if (deleteFinanceError) console.error("Gagal menghapus record finance terkait:", deleteFinanceError);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoice-page-data'] });
            queryClient.invalidateQueries({ queryKey: ['finances'] });
            queryClient.invalidateQueries({ queryKey: ['developer-stats'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            toast({ title: 'Sukses', description: 'Status Invoice & Catatan Keuangan berhasil diupdate.' });
        },
        onError: (error: any) => {
            toast({ title: 'Error Update Status', description: `Gagal mengupdate: ${error.message}`, variant: 'destructive' });
        }
    });


    return {
        invoices: allData?.invoices || [],
        projects: allData?.projects || [],
        company: allData?.company,
        isLoading,
        createMutation,
        updateMutation,
        deleteMutation,
        updateStatusMutation
    };
};

// ======================= KOMPONEN UTAMA =======================
export default function Invoices() {
    const { toast } = useToast();
    const { invoices, projects, company, isLoading, createMutation, updateMutation, deleteMutation, updateStatusMutation } = useInvoiceData();
    const [searchQuery, setSearchQuery] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [viewedInvoice, setViewedInvoice] = useState<Invoice | null>(null);
    const invoiceRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState<InvoiceInsert>({ // Gunakan tipe InvoiceInsert
        project_id: '',
        invoice_number: '', // Akan di-generate
        tanggal_terbit: format(new Date(), 'yyyy-MM-dd'),
        jatuh_tempo: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        amount: 0,
        status: 'menunggu_dp',
        created_by: undefined, // Defaultnya undefined, akan diisi di handleSubmit
        pdf_url: undefined, // Akan diisi di handleSubmit
        // Kolom lain yang mungkin wajib diisi (sesuaikan dengan tabel 'invoices')
    });

    const selectedProject = projects.find(p => p.id === formData.project_id);

    useEffect(() => {
        if (selectedProject && !editingInvoice) {
            setFormData(prev => ({ ...prev, amount: selectedProject.harga || 0, }));
        } else if (!selectedProject && !editingInvoice) {
            setFormData(prev => ({ ...prev, amount: 0 }));
        }
    }, [formData.project_id, selectedProject, editingInvoice]);


    // [PERBAIKAN RLS] Fungsi handleSubmit diubah menjadi async dan mengirim created_by
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.project_id) {
            return toast({ title: 'Error', description: 'Pilih Proyek terlebih dahulu.', variant: 'destructive' });
        }
        if (formData.amount <= 0) {
            return toast({ title: 'Error', description: 'Jumlah tagihan harus lebih dari 0.', variant: 'destructive'});
        }

        // --- AMBIL ID USER ---
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
             toast({ title: 'Error Autentikasi', description: 'Gagal mendapatkan data pengguna. Coba login ulang.', variant: 'destructive'});
             return;
        }
        // --- AKHIR AMBIL ID USER ---

        const invoiceNumber = editingInvoice ? editingInvoice.invoice_number : generateUniqueNumber('INV');

        // Pastikan semua kolom WAJIB di tabel 'invoices' ada di sini
        const dataToSend: InvoiceInsert = {
            project_id: formData.project_id,
            invoice_number: invoiceNumber,
            tanggal_terbit: formData.tanggal_terbit,
            jatuh_tempo: formData.jatuh_tempo,
            amount: formData.amount,
            status: formData.status as any, // Hati-hati dengan casting 'as any'
            pdf_url: `/download-files/${invoiceNumber}.pdf`,
            created_by: user.id // <-- KIRIM ID PENGGUNA
            // Tambahkan kolom lain jika perlu, contoh:
            // paid_at: null, // Atau nilai default lain jika diperlukan
        };

        if (editingInvoice) {
            // Update mutation (jika Anda perlu logika update, pastikan RLS UPDATE juga sesuai)
            // Hapus 'created_by' jika tidak boleh diubah saat update
            const { created_by, ...updateData } = dataToSend;
            updateMutation.mutate({ ...(updateData as Partial<Invoice>), id: editingInvoice.id }, {
                 onSuccess: () => setDialogOpen(false)
            });
        } else {
            // Create mutation
            createMutation.mutate(dataToSend, {
                 onSuccess: () => setDialogOpen(false)
            });
        }
    };


    const handleMarkPaid = (invoice: Invoice) => {
        const isLunasBefore = invoice.status === 'lunas';
        const newStatus = isLunasBefore ? 'menunggu_dp' : 'lunas';
        const paid_at = isLunasBefore ? null : new Date().toISOString();
        const isLunasNow = newStatus === 'lunas';
        const projectDetails = invoice.projects ? {
            developer_id: invoice.projects.developer_id,
            fee_developer: invoice.projects.fee_developer,
            nama_proyek: invoice.projects.nama_proyek,
            client_id: invoice.projects.client_id
        } : null;
        updateStatusMutation.mutate({
            id: invoice.id,
            status: newStatus,
            paid_at,
            amount: invoice.amount || 0,
            isLunasNow,
            projectDetails
        });
    };

    const handleViewTemplate = (invoice: Invoice) => {
        setViewedInvoice(invoice);
        setIsViewOpen(true);
    };

    const handleGenerateAndDownload = async () => {
        toast({ title: 'Processing', description: 'Memulai generate PDF...' });

        setTimeout(async () => {
            const elementToCapture = invoiceRef.current;
            if (!elementToCapture || !viewedInvoice) {
                toast({ title: 'Error', description: 'Template invoice belum dimuat atau data tidak ada.', variant: 'destructive' });
                setIsViewOpen(false);
                return;
            }
            try {
                const canvas = await html2canvas(elementToCapture, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgWidth = pdfWidth;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                let heightLeft = imgHeight;
                let position = 0;
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }
                pdf.save(`${viewedInvoice.invoice_number}.pdf`);
                toast({ title: 'Success', description: `Invoice ${viewedInvoice.invoice_number} berhasil diunduh!`, duration: 3000 });
            } catch (error) {
                console.error("PDF Client Generation Error:", error);
                toast({ title: 'Fatal Error', description: 'Gagal membuat file PDF.', variant: 'destructive', duration: 5000 });
            } finally {
                 setIsViewOpen(false);
            }
        }, 300);
    };


    const handleDelete = () => {
        if (deleteId) {
            deleteMutation.mutate(deleteId, {
                onSuccess: () => setDeleteId(null)
            });
        }
    };

    const resetForm = () => {
        setFormData({
            project_id: '',
            invoice_number: '',
            tanggal_terbit: format(new Date(), 'yyyy-MM-dd'),
            jatuh_tempo: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
            amount: 0,
            status: 'menunggu_dp',
            created_by: undefined,
            pdf_url: undefined,
        });
        setEditingInvoice(null);
    };

    const openEditDialog = (invoice: Invoice) => {
        setEditingInvoice(invoice);
        // Sesuaikan state form agar cocok dengan tipe InvoiceInsert saat mengedit
        setFormData({
            project_id: invoice.project_id || '',
            invoice_number: invoice.invoice_number || '',
            tanggal_terbit: invoice.tanggal_terbit ? format(parseISO(invoice.tanggal_terbit), 'yyyy-MM-dd') : '',
            jatuh_tempo: invoice.jatuh_tempo ? format(parseISO(invoice.jatuh_tempo), 'yyyy-MM-dd') : '',
            amount: invoice.amount || 0,
            status: invoice.status || 'menunggu_dp',
            created_by: invoice.created_by, // Ambil created_by dari data invoice
            pdf_url: invoice.pdf_url, // Ambil pdf_url dari data invoice
            // Isi kolom lain jika ada
        });
        setDialogOpen(true);
    };

    const filteredInvoices = invoices.filter((inv) => {
        const searchLower = searchQuery.toLowerCase();
        const projectMatch = inv.projects?.nama_proyek?.toLowerCase().includes(searchLower);
        const clientMatch = inv.clients?.nama?.toLowerCase().includes(searchLower);
        const numberMatch = inv.invoice_number?.toLowerCase().includes(searchLower);
        return projectMatch || clientMatch || numberMatch;
    });

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Invoice</h2>
                        <p className="text-muted-foreground">
                            Kelola tagihan dan status pembayaran.
                        </p>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2 h-4 w-4" />New Invoice</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'Buat Invoice Baru'}</DialogTitle>
                                {editingInvoice && <DialogDescription>No: {editingInvoice.invoice_number}</DialogDescription>}
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="project_id">Pilih Proyek *</Label>
                                    <Select
                                        value={formData.project_id}
                                        onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value }))}
                                        required
                                        disabled={!!editingInvoice}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih proyek" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {isLoading ? (
                                                <div className="px-2 py-1.5 text-sm text-muted-foreground">Memuat...</div>
                                            ) : projects.length === 0 ? (
                                                <div className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada Proyek Aktif</div>
                                            ) : (
                                                projects.map((p) => (
                                                    <SelectItem key={p.id} value={p.id!}>{p.nama_proyek} ({p.clients?.nama})</SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {editingInvoice && <p className='text-xs text-muted-foreground'>Proyek tidak bisa diubah setelah invoice dibuat.</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="invoice_number_display">Nomor Invoice</Label>
                                        <Input
                                            id="invoice_number_display"
                                            value={editingInvoice ? editingInvoice.invoice_number : 'Otomatis'}
                                            disabled
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="amount">Total Harga (IDR) *</Label>
                                        <Input
                                            id="amount"
                                            type="number"
                                            value={formData.amount}
                                            onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                            required
                                            min="1"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="tanggal_terbit">Tanggal Terbit *</Label>
                                        <Input
                                            id="tanggal_terbit"
                                            type="date"
                                            value={formData.tanggal_terbit || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, tanggal_terbit: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="jatuh_tempo">Jatuh Tempo *</Label>
                                        <Input
                                            id="jatuh_tempo"
                                            type="date"
                                            value={formData.jatuh_tempo || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, jatuh_tempo: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="status">Status</Label>
                                        <Select value={formData.status || 'menunggu_dp'} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="draft">Draft</SelectItem>
                                                <SelectItem value="menunggu_dp">Menunggu DP</SelectItem>
                                                <SelectItem value="lunas_dp">DP Lunas</SelectItem>
                                                <SelectItem value="menunggu_pelunasan">Menunggu Pelunasan</SelectItem>
                                                <SelectItem value="lunas">Lunas</SelectItem>
                                                <SelectItem value="overdue">Overdue</SelectItem>
                                                <SelectItem value="batal">Batal</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <DialogFooter className="pt-4">
                                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || !formData.project_id || formData.amount <= 0}>
                                        {createMutation.isPending || updateMutation.isPending ? 'Memproses...' : (editingInvoice ? 'Update Invoice' : 'Buat Invoice')}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardHeader><CardTitle>Daftar Invoice ({invoices.length})</CardTitle></CardHeader>
                    <CardContent>
                        <div className="relative mb-4">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nomor invoice, proyek, atau klien..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="rounded-md border overflow-x-auto"><Table>
                            <TableHeader><TableRow>
                                <TableHead>Nomor Invoice</TableHead>
                                <TableHead>Proyek / Klien</TableHead>
                                <TableHead>Terbit / Jatuh Tempo</TableHead>
                                <TableHead className='text-right'>Jumlah</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center">Memuat...</TableCell></TableRow>
                                ) : filteredInvoices.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada invoice ditemukan.</TableCell></TableRow>
                                ) : (
                                    filteredInvoices.map((invoice) => {
                                        const isLunas = invoice.status === 'lunas';
                                        return (
                                            <TableRow key={invoice.id}>
                                                <TableCell className="font-medium">{invoice.invoice_number || '-'}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{invoice.projects?.nama_proyek || '-'}</div>
                                                    <div className="text-sm text-muted-foreground">{invoice.clients?.nama || 'N/A'}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Calendar className='w-3 h-3 text-muted-foreground'/>
                                                        {invoice.tanggal_terbit ? format(parseISO(invoice.tanggal_terbit), 'dd/MM/yy') : '-'}
                                                        <ArrowRight className='w-3 h-3'/>
                                                        {invoice.jatuh_tempo ? format(parseISO(invoice.jatuh_tempo), 'dd/MM/yy') : '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                    {formatCurrency(invoice.amount)}
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(invoice.status)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="icon" variant="ghost" title="Lihat Detail Invoice" onClick={() => handleViewTemplate(invoice)} className="h-8 w-8">
                                                            <FileText className="h-4 w-4 text-blue-600" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" title={isLunas ? 'Tandai Belum Lunas' : 'Tandai Lunas'} onClick={() => handleMarkPaid(invoice)} className={`h-8 w-8 ${isLunas ? 'text-green-600 hover:bg-green-100' : 'text-gray-500 hover:bg-yellow-100'}`} disabled={updateStatusMutation.isPending && updateStatusMutation.variables?.id === invoice.id}>
                                                            <DollarSign className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" onClick={() => openEditDialog(invoice)} className="h-8 w-8" title="Edit">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(invoice.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Hapus" disabled={deleteMutation.isPending && deleteMutation.variables === invoice.id}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table></div>
                    </CardContent>
                </Card>

                <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Invoice?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Invoice ini akan dihapus permanen, termasuk catatan keuangan terkait. Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className={buttonVariants({ variant: "destructive" })} disabled={deleteMutation.isPending}>
                                {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                        <DialogHeader className="p-4 border-b">
                            <DialogTitle>Preview Invoice {viewedInvoice?.invoice_number}</DialogTitle>
                        </DialogHeader>
                        {viewedInvoice && (
                            <div className="p-0">
                                <InvoiceView invoice={viewedInvoice} company={company} ref={invoiceRef} />
                            </div>
                        )}
                        <DialogFooter className="p-4 border-t bg-background sticky bottom-0">
                            <Button
                                variant="secondary"
                                onClick={handleGenerateAndDownload}
                                disabled={!viewedInvoice || updateStatusMutation.isPending}
                            >
                                <Download className="h-4 w-4 mr-2" /> Cetak ke PDF
                            </Button>
                            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Tutup</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </DashboardLayout>
    );
}