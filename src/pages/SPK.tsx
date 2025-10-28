import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
// Textarea tidak lagi digunakan di form SPK
// import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Import AlertDialog components
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    // AlertDialogTrigger, // Tidak digunakan langsung di tombol, state control
} from "@/components/ui/alert-dialog";
import { PlusCircle, Search, Download, FileCheck, ClipboardCopy, Trash2 } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateUniqueNumber } from '@/lib/number-generator';
import type { Database } from '@/integrations/supabase/types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SPKTemplate } from '@/templates/SPKTemplate';
import { useAuth } from '@/lib/auth'; // Import useAuth


// Definisikan Tipe Data
type ProjectExtended = Database['public']['Tables']['projects']['Row'] & {
    ruang_lingkup: string | null;
    clients: {
        nama: string,
        bisnis: string,
        alamat: string | null,
        email: string | null,
        phone: string | null,
        whatsapp: string | null,
    } | null
};
type Company = Database['public']['Tables']['companies']['Row'] & {
    email?: string | null;
    telp?: string | null;
};
type SPK = Database['public']['Tables']['spks']['Row'] & { projects: { nama_proyek: string, client_id: string, clients?: { nama: string } | null } | null };
type SPKInsert = Database['public']['Tables']['spks']['Insert'];
type SPKTemplateProps = React.ComponentProps<typeof SPKTemplate>;

const initialFormData = {
    projectId: '', // Tetap string kosong untuk state awal
};

// ======================= DATA FETCHING & MUTATION =======================
const useSPKData = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const dummyCompany: Company = {
      id: "dummy-company-id",
      nama: 'Nama Perusahaan Anda (Default)',
      alamat: 'Alamat Perusahaan Anda (Default)',
      rekening: 'Rekening Perusahaan Anda (Default)',
      logo_url: '/download-files/logo.png',
      signature_url: '/download-files/ttd.png',
      email: 'email@default.com',
      telp: '081234567890',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      npwp: null,
    };

    const { data: allData, isLoading } = useQuery({
      queryKey: ['spk-page-data'],
      queryFn: async () => {
        try {
          const [spksRes, projectsRes, companyRes] = await Promise.all([
            supabase.from('spks').select(`
                *,
                projects (
                    nama_proyek,
                    client_id,
                    clients ( nama )
                )
            `).order('created_at', { ascending: false }),
            supabase.from('projects').select(`
                id,
                nama_proyek,
                harga,
                client_id,
                ruang_lingkup,
                clients (nama, bisnis, alamat, email, phone, whatsapp)
            `).neq('status', 'selesai'),
            supabase.from('companies').select('*, email, telp').limit(1).maybeSingle(),
          ]);

          if (spksRes.error) throw spksRes.error;
          if (projectsRes.error) throw projectsRes.error;
          if (companyRes.error && companyRes.status !== 406) {
             console.warn("Company fetch error (ignored if not found):", companyRes.error);
          }

          const companyData = companyRes.data || dummyCompany;

          const finalCompanyData = {
            ...companyData,
            logo_url: companyData?.logo_url || dummyCompany.logo_url,
            signature_url: companyData?.signature_url || dummyCompany.signature_url,
          } as Company;

          console.log("Fetched SPKs:", spksRes.data);
          console.log("Fetched Projects for SPK:", projectsRes.data);
          console.log("Using Company Data:", finalCompanyData);

          return {
              spks: spksRes.data as SPK[],
              projects: projectsRes.data as ProjectExtended[],
              company: finalCompanyData,
          };
        } catch (error: any) {
          toast({ title: 'Error Memuat Data SPK', description: error.message, variant: 'destructive' });
          return { spks: [], projects: [], company: dummyCompany };
        }
      },
    });

    const createMutation = useMutation({
        mutationFn: async (data: SPKInsert) => {
            const { error } = await supabase.from('spks').insert(data);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spk-page-data'] });
        },
        onError: (error: any) => {
            toast({ title: 'Error Database', description: `Gagal menyimpan SPK: ${error.message}`, variant: 'destructive' });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('spks').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['spk-page-data'] });
            toast({ title: 'SPK Berhasil Dihapus', description: 'Dokumen SPK telah dihapus dari database.', duration: 3000 });
        },
        onError: (error: any) => {
            toast({ title: 'Error Hapus SPK', description: error.message, variant: 'destructive' });
        }
    });

    return { data: allData, isLoading, createMutation, deleteMutation };
};
// ========================================================================

export default function SPK() {
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState(initialFormData);
    const { toast } = useToast();
    const { user } = useAuth(); // Ambil user

    // State dan Ref untuk View/PDF Generation
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [viewedSPKData, setViewedSPKData] = useState<SPKTemplateProps | null>(null);
    const spkRef = useRef<HTMLDivElement>(null);

    // State untuk AlertDialog Hapus
    const [spkToDelete, setSpkToDelete] = useState<SPK | null>(null);


    const { data, isLoading, createMutation, deleteMutation } = useSPKData();
    const { spks = [], projects = [], company } = data || { spks: [], projects: [], company: null };

    // FIX: Gunakan || '' untuk memastikan value tidak undefined saat tidak ada yang dipilih
    const selectedProject = projects.find(p => p.id === (formData.projectId || ''));
    const mutation = createMutation;

    const formatCurrency = (amount: number | null | undefined) => {
         if (amount == null || isNaN(Number(amount))) return '-';
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(Number(amount));
    };

    const handleGenerateAndDownload = async () => {
        const elementToCapture = spkRef.current;
        if (!elementToCapture || !viewedSPKData) return toast({ title: 'Error', description: 'Template SPK belum dimuat.', variant: 'destructive' });
        toast({ title: 'Processing', description: 'Memulai generate PDF SPK...' });
        try {
            const canvas = await html2canvas(elementToCapture, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210, pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight, position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            pdf.save(`${viewedSPKData.spkNumber}.pdf`);
            toast({ title: 'Success', description: `SPK ${viewedSPKData.spkNumber} berhasil diunduh!`, duration: 3000 });
        } catch (error) {
            console.error("PDF Client Generation Error:", error);
            toast({ title: 'Fatal Error', description: 'Gagal membuat file PDF. Cek F12 Console.', variant: 'destructive', duration: 5000 });
        } finally {
            setIsViewOpen(false);
        }
    };

    const prepareTemplateData = (spkNumber: string, project: ProjectExtended): SPKTemplateProps | null => {
         if (!company) return toast({ title: 'Error', description: 'Data perusahaan tidak tersedia.', variant: 'destructive' }), null;
         const client = project.clients;
         const clientTelp = client?.whatsapp || client?.phone || '-';
         return {
            spkNumber,
            todayDate: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
            totalPrice: Number(project.harga),
            companyName: company.nama || 'Nama Perusahaan Default',
            companyAddress: company.alamat || 'Alamat Default',
            companyAccount: company.rekening || 'Rekening Default',
            logoUrl: company.logo_url,
            signatureUrl: company.signature_url,
            companyEmail: company.email || '-',
            companyTelp: company.telp || '-',
            clientName: client?.nama || '-',
            clientBusiness: client?.bisnis || '-',
            clientAddress: client?.alamat || '-',
            clientEmail: client?.email || '-',
            clientTelp: clientTelp,
            projectName: project.nama_proyek,
            scopeOfWork: project.ruang_lingkup || 'Sesuai detail proyek.',
            websiteType: project.nama_proyek,
        };
    }

    const openExistingSPKPreview = (spk: SPK) => {
        const project = projects.find(p => p.id === spk.project_id);
        if (!project || !company) return toast({ title: 'Error', description: 'Detail proyek/perusahaan tidak ditemukan.', variant: 'destructive' });
        const templateData = prepareTemplateData(spk.spk_number, project);
         if (templateData) {
              templateData.todayDate = new Date(spk.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
              setViewedSPKData(templateData);
              setIsViewOpen(true);
         }
    }

    const handleSaveAndPreview = (spkNumber: string, project: ProjectExtended) => {
        const templateData = prepareTemplateData(spkNumber, project);
         if (templateData) {
             setViewedSPKData(templateData);
             setIsViewOpen(true);
         }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!company) return toast({ title: 'Error', description: 'Gagal memuat data perusahaan.', variant: 'destructive' });
        if (!formData.projectId || !selectedProject) return toast({ title: 'Error', description: 'Pilih proyek terlebih dahulu.', variant: 'destructive' });

        if (!company.nama || !company.logo_url || !company.signature_url || !company.alamat || !company.rekening || !company.email || !company.telp) {
             const missingFields = [!company.nama && "Nama",!company.logo_url && "Logo",!company.signature_url && "TTD",!company.alamat && "Alamat",!company.rekening && "Rekening",!company.email && "Email",!company.telp && "Telp"].filter(Boolean).join(', ');
             toast({ title: 'Data Perusahaan Belum Lengkap', description: `Harap lengkapi ${missingFields} di Pengaturan.`, variant: 'destructive', duration: 7000 });
             // return; // Tetap generate jika ingin pakai default
        }
         if (!selectedProject.clients?.nama || !selectedProject.clients?.alamat) {
             toast({ title: 'Data Klien Belum Lengkap', description: `Harap lengkapi Nama dan Alamat Klien.`, variant: 'destructive', duration: 7000 });
             return;
         }

        const spkNumber = generateUniqueNumber('SPK');
        const mockPdfUrl = `/uploads/spk/${spkNumber}.pdf`;

        const newSPK: SPKInsert = {
            spk_number: spkNumber,
            project_id: formData.projectId,
            terms_conditions: 'Template Otomatis Sesuai SPKTemplate.tsx',
            payment_terms: 'Template Otomatis Sesuai SPKTemplate.tsx',
            pdf_url: mockPdfUrl,
            created_by: user?.id // Ambil ID user yang login
        };

        mutation.mutate(newSPK, {
            onSuccess: () => {
                toast({ title: "SPK Berhasil Dibuat!", description: `No: ${spkNumber}. Membuka preview...`, });
                setIsDialogOpen(false);
                setFormData(initialFormData);
                handleSaveAndPreview(spkNumber, selectedProject);
            }
        });
    };

    const confirmDeleteSPK = (spk: SPK) => setSpkToDelete(spk);
    const executeDeleteSPK = () => { if (spkToDelete) deleteMutation.mutate(spkToDelete.id); };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => toast({ title: 'Nomor SPK disalin!' }),
         (err) => toast({ title: 'Gagal menyalin', description: err.message, variant: 'destructive' })
        );
    };

    const filteredSPKs = spks.filter(s =>
        s.spk_number.toLowerCase().includes(search.toLowerCase()) ||
        s.projects?.nama_proyek?.toLowerCase().includes(search.toLowerCase()) || // Safely access nama_proyek
        s.projects?.clients?.nama?.toLowerCase().includes(search.toLowerCase()) // Safely access client name
    );

    const isCompanySetupComplete = !!(company && company.nama && company.logo_url && company.signature_url && company.alamat && company.rekening && company.email && company.telp);

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">SPK (Surat Perintah Kerja)</h2>
                        <p className="text-muted-foreground">
                            Generate dan kelola surat perjanjian kerja
                        </p>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                             {/* Nonaktifkan tombol jika company belum lengkap */}
                            <Button onClick={() => setFormData(initialFormData)} disabled={isLoading || !isCompanySetupComplete} title={!isCompanySetupComplete ? "Lengkapi data perusahaan di Pengaturan" : "Buat SPK Baru"}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Generate SPK Baru
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>Generate Surat Perjanjian Kerja</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {isLoading ? (
                                    <div className="text-muted-foreground">Memuat data...</div>
                                ) : !isCompanySetupComplete ? ( // Tampilkan peringatan jika belum lengkap
                                    <div className="text-red-500 border border-red-200 bg-red-50 p-3 rounded-md text-sm">
                                        ⚠️ **PENTING:** Lengkapi **semua** data Perusahaan di <a href="/settings" className="font-semibold underline">Pengaturan</a> sebelum membuat SPK.
                                    </div>
                                ) : null }

                                <div className="space-y-2">
                                    <Label htmlFor="project">Pilih Proyek *</Label>
                                    {/* FIX: Gunakan `undefined` saat value kosong untuk Select */}
                                    <Select required value={formData.projectId || undefined} onValueChange={(val) => setFormData({ ...formData, projectId: val })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih proyek yang akan dibuat SPK" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {/* FIX: Tambahkan SelectItem khusus untuk placeholder jika tidak ada proyek */}
                                            {projects.length === 0 && <SelectItem value="no-projects" disabled>Tidak ada proyek aktif</SelectItem>}
                                            {projects.map((p) => (
                                                // Pastikan p.id tidak null atau undefined
                                                p.id ? <SelectItem key={p.id} value={p.id}>
                                                    {p.nama_proyek} ({p.clients?.nama || 'Klien ?'}) - {formatCurrency(Number(p.harga))}
                                                </SelectItem> : null
                                            ))}
                                        </SelectContent>
                                    </Select>
                                     {selectedProject && !selectedProject.clients?.alamat && (
                                         <p className="text-xs text-red-500">Alamat klien ini belum diisi. Harap lengkapi di halaman Klien.</p>
                                     )}
                                </div>

                                <div className="space-y-2 text-muted-foreground border p-4 rounded-md text-sm">
                                    <p>Syarat & Ketentuan serta Ketentuan Pembayaran akan digenerate otomatis.</p>
                                </div>

                                <DialogFooter>
                                     <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                                    <Button
                                        type="submit"
                                        disabled={mutation.isPending || !formData.projectId || !isCompanySetupComplete || !selectedProject?.clients?.alamat}
                                    >
                                        <FileCheck className="mr-2 h-4 w-4" />
                                        {mutation.isPending ? "Memproses..." : "Generate & Simpan SPK"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* SPK List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Dokumen SPK Tersimpan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative mb-4">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nomor SPK, proyek, atau klien..."
                                className="pl-8"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nomor SPK</TableHead>
                                        <TableHead>Proyek</TableHead>
                                        <TableHead>Klien</TableHead>
                                        <TableHead>Tanggal Dibuat</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Memuat data...</TableCell></TableRow>
                                    ) : filteredSPKs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Belum ada dokumen SPK.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredSPKs.map((spk) => (
                                            <TableRow key={spk.id}>
                                                <TableCell className="font-medium flex items-center gap-1">
                                                    {spk.spk_number}
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(spk.spk_number)} title="Salin Nomor SPK">
                                                        <ClipboardCopy className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                                <TableCell>{spk.projects?.nama_proyek || '-'}</TableCell>
                                                <TableCell>{spk.projects?.clients?.nama || '-'}</TableCell>
                                                <TableCell>{new Date(spk.created_at).toLocaleDateString('id-ID')}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" variant="outline" title="Lihat Detail & Download SPK" onClick={() => openExistingSPKPreview(spk)}>
                                                             <Download className="mr-2 h-4 w-4" /> Preview & Cetak
                                                        </Button>
                                                        <Button size="icon" variant="ghost" title="Hapus Dokumen SPK" disabled={deleteMutation.isPending && spkToDelete?.id === spk.id} onClick={() => confirmDeleteSPK(spk)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* DIALOG TEMPLATE VIEW SPK */}
                <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                        <div ref={spkRef} className="bg-white">
                            {viewedSPKData && <SPKTemplate {...viewedSPKData} />}
                        </div>
                        <DialogFooter className="p-4 border-t bg-background sticky bottom-0">
                             <Button variant="secondary" onClick={handleGenerateAndDownload} disabled={!viewedSPKData}>
                                 <Download className="h-4 w-4 mr-2" /> Cetak ke PDF (Download)
                             </Button>
                             <Button variant="outline" onClick={() => setIsViewOpen(false)}>Tutup</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* AlertDialog untuk Konfirmasi Hapus SPK */}
                 <AlertDialog open={!!spkToDelete} onOpenChange={() => setSpkToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Dokumen SPK?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Anda yakin ingin menghapus dokumen SPK <span className="font-semibold">{spkToDelete?.spk_number}</span>? Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={executeDeleteSPK} disabled={deleteMutation.isPending} className={buttonVariants({ variant: "destructive" })}>
                            {deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus Dokumen'}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </DashboardLayout>
    );
}