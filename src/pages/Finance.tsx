import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign, FileText, FileDown, AlertTriangle } from "lucide-react";
import React, { useState, useRef, useMemo } from "react"; // FIX: Tambahkan useMemo
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import html2canvas from 'html2canvas'; 
import jsPDF from 'jspdf'; 
import * as XLSX from 'xlsx'; // Import XLSX
import { format } from 'date-fns'; // FIX: Import fungsi format yang hilang
import { id } from 'date-fns/locale'; // Import locale untuk format tanggal Indonesia

type Finance = Database['public']['Tables']['finances']['Row'];
type FinanceInsert = Database['public']['Tables']['finances']['Insert'];
type FinanceType = Database['public']['Enums']['finance_type'];
type FinanceCategory = Database['public']['Enums']['finance_category'];
type Company = Database['public']['Tables']['companies']['Row'];

// Utility untuk format mata uang
const formatCurrency = (amount: number | null | undefined, digits = 0) => {
    if (amount == null || isNaN(Number(amount))) return 'Rp 0';
    const numAmount = Number(amount);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(numAmount);
};

// Hook baru untuk mengambil data perusahaan
const useCompanyQuery = () => {
    return useQuery({
        queryKey: ['company-data-for-finance'],
        queryFn: async () => {
             const { data, error } = await supabase.from('companies').select('nama, alamat, logo_url, signature_url').limit(1).maybeSingle();
             if (error) {
                 console.error("Failed to fetch company data:", error);
                 return null;
             }
             return data as Company | null;
        }
    });
};


export default function Finance() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFinance, setEditingFinance] = useState<Finance | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<FinanceInsert>>({
    tipe: "income" as FinanceType,
    kategori: "pendapatan" as FinanceCategory,
    nominal: 0,
    keterangan: "",
    tanggal: format(new Date(), 'yyyy-MM-dd') // FIX: Gunakan format() di sini
  });
  // State Filter Laporan
  const [filterMonth, setFilterMonth] = useState<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`); // Format YYYY-MM
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const reportRef = useRef<HTMLDivElement>(null); // Ref untuk area cetak

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch semua data keuangan
  const { data: finances = [], isLoading } = useQuery({
    queryKey: ['finances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finances')
        .select('*')
        .order('tanggal', { ascending: false });

      if (error) throw error;
      return data.map(f => ({ ...f, nominal: Number(f.nominal) })) as Finance[];
    }
  });

  const { data: company, isLoading: isLoadingCompany } = useCompanyQuery();
  
  // LOGIKA FILTER DAN PERHITUNGAN
  const { filteredFinances, totalIncome, totalExpense, balance, pphFinalAmount, omzetBulanIni, transactionSummary } = useMemo(() => {
        const filtered = finances.filter(finance => {
            const searchMatch = !search || (finance.keterangan?.toLowerCase().includes(search.toLowerCase()));
            const dateMatch = !filterMonth || finance.tanggal.startsWith(filterMonth);
            const typeMatch = filterType === 'all' || finance.tipe === filterType;
            return searchMatch && dateMatch && typeMatch;
        });

        const income = filtered
            .filter(f => f.tipe === 'income')
            .reduce((sum, f) => sum + f.nominal, 0);

        const expense = filtered
            .filter(f => f.tipe === 'expense')
            .reduce((sum, f) => sum + f.nominal, 0);

        const net = income - expense;
        const pphRate = 0.005;
        const pph = income * pphRate;

        // Grouping for excel/pdf table
        const summary = filtered.map(f => ({
            tanggal: f.tanggal,
            tipe: f.tipe === 'income' ? 'Pemasukan' : 'Pengeluaran',
            kategori: f.kategori,
            keterangan: f.keterangan,
            income: f.tipe === 'income' ? f.nominal : 0,
            expense: f.tipe === 'expense' ? f.nominal : 0,
        }));
        
        return { 
            filteredFinances: filtered, 
            totalIncome: income, 
            totalExpense: expense, 
            balance: net, 
            pphFinalAmount: pph, 
            omzetBulanIni: income,
            transactionSummary: summary
        };
    }, [finances, search, filterMonth, filterType]);


  const createMutation = useMutation({
    mutationFn: async (newFinance: FinanceInsert) => {
      const { data, error } = await supabase
        .from('finances')
        .insert(newFinance)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      toast({ title: "Transaksi berhasil ditambahkan" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Finance> & { id: string }) => {
      const { data, error } = await supabase
        .from('finances')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      toast({ title: "Transaksi berhasil diupdate" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('finances')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      toast({ title: "Transaksi berhasil dihapus" });
      setDeleteId(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      tipe: "income" as FinanceType,
      kategori: "pendapatan" as FinanceCategory,
      nominal: 0,
      keterangan: "",
      tanggal: format(new Date(), 'yyyy-MM-dd') // FIX: Gunakan format() di sini
    });
    setEditingFinance(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.nominal === 0 || !formData.nominal || formData.nominal < 0) {
        toast({ title: "Error", description: "Nominal tidak boleh nol atau negatif.", variant: "destructive" });
        return;
    }

    if (editingFinance) {
      updateMutation.mutate({ id: editingFinance.id, ...formData });
    } else {
      createMutation.mutate(formData as FinanceInsert);
    }
  };

  const handleEdit = (finance: Finance) => {
    setEditingFinance(finance);
    setFormData({
      tipe: finance.tipe,
      kategori: finance.kategori,
      nominal: Number(finance.nominal),
      keterangan: finance.keterangan || "",
      tanggal: finance.tanggal
    });
    setIsDialogOpen(true);
  };

  // --- FUNGSI EXPORT EXCEL ---
  const handleExportExcel = () => {
        if (transactionSummary.length === 0) {
            toast({ title: "Info", description: "Tidak ada data untuk diexport." });
            return;
        }

        const monthYear = filterMonth.replace('-', '_');
        const fileName = `Laporan_Keuangan_${monthYear}.xlsx`;
        
        // Sheet 1: Transaksi Detail
        const detailData = transactionSummary.map(t => ({
            Tanggal: t.tanggal,
            Tipe: t.tipe,
            Kategori: t.kategori,
            Keterangan: t.keterangan,
            Pemasukan: t.income,
            Pengeluaran: t.expense,
        }));
        
        // Tambahkan baris total
        detailData.push({
             Tanggal: 'TOTAL',
             Tipe: '',
             Kategori: '',
             Keterangan: '',
             Pemasukan: totalIncome,
             Pengeluaran: totalExpense,
        });

        const wsDetail = XLSX.utils.json_to_sheet(detailData, { header: ["Tanggal", "Tipe", "Kategori", "Keterangan", "Pemasukan", "Pengeluaran"] });
        XLSX.utils.sheet_add_aoa(wsDetail, [[`Laporan Keuangan - Periode ${filterMonth}`]], { origin: "A1" });
        
        // Sheet 2: Ringkasan Laba Rugi
        const summaryData = [
            { Item: 'Total Pemasukan (Omzet)', Nominal: totalIncome },
            { Item: 'Total Pengeluaran', Nominal: totalExpense },
            { Item: 'Saldo Bersih', Nominal: balance },
            { Item: 'Simulasi PPh Final (0.5% dari Omzet)', Nominal: pphFinalAmount },
        ];
        
        const wsSummary = XLSX.utils.json_to_sheet(summaryData, { header: ["Item", "Nominal"] });
        XLSX.utils.sheet_add_aoa(wsSummary, [[`Ringkasan Laba Rugi - Periode ${filterMonth}`]], { origin: "A1" });


        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsDetail, "Transaksi");
        XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");
        
        XLSX.writeFile(wb, fileName);
        toast({ title: "Export Excel Berhasil", description: `${fileName} telah didownload.` });
    };

  // --- FUNGSI CETAK LAPORAN PDF ---
  const handlePrintReport = async () => {
        const reportElement = reportRef.current;
        if (!reportElement) return;

        toast({ title: 'Mencetak Laporan', description: 'Memproses PDF...' });

        try {
            // Pindahkan elemen ke viewport agar dapat dicapture
            reportElement.style.position = 'static';
            reportElement.style.left = 'auto';
            reportElement.style.top = 'auto';
            reportElement.style.width = '794px'; // A4 width for consistent rendering
            window.scrollTo(0, 0); // Scroll ke atas

            const canvas = await html2canvas(reportElement, { 
                scale: 2, 
                backgroundColor: '#ffffff',
                useCORS: true, 
                logging: false,
                ignoreElements: (element) => element.classList.contains('print-hide')
             }); 
            
            // Kembalikan elemen ke posisi semula (di luar layar)
            reportElement.style.position = 'absolute';
            reportElement.style.left = '-9999px';
            reportElement.style.top = '-9999px';


            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 190; // Lebar konten di A4 (210 - 20mm margin)
            const pageHeight = 297; // Tinggi A4
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 10; // Margin atas 10mm

            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight); 
            heightLeft -= (pageHeight - 20); 

            while (heightLeft > 0) { 
              position = 10 - imgHeight + (pageHeight - 20) * (Math.floor(imgHeight / (pageHeight - 20)));
              pdf.addPage();
              pdf.addImage(imgData, 'PNG', 10, -heightLeft + 10, imgWidth, imgHeight); 
              heightLeft -= (pageHeight - 20);
            }
            
            pdf.save(`Laporan_Keuangan_${filterMonth}.pdf`);
            toast({ title: 'Sukses', description: 'Laporan PDF berhasil dibuat.' });
        } catch (error) {
            console.error("PDF Generation Error:", error);
            toast({ title: 'Error Cetak', description: 'Gagal membuat PDF. Cek console log (F12).', variant: 'destructive' });
             if (reportElement) {
                reportElement.style.position = 'absolute';
                reportElement.style.left = '-9999px';
                reportElement.style.top = '-9999px';
            }
        }
    };


  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header & Tombol Aksi */}
        <div className="flex justify-between items-center print-hide">
          <h1 className="text-3xl font-bold">Keuangan</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Tambah Transaksi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingFinance ? "Edit Transaksi" : "Tambah Transaksi Baru"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="tipe">Tipe</Label>
                  <Select
                    value={formData.tipe}
                    onValueChange={(value) => setFormData({ ...formData, tipe: value as FinanceType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Pemasukan</SelectItem>
                      <SelectItem value="expense">Pengeluaran</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="kategori">Kategori</Label>
                  <Select
                    value={formData.kategori}
                    onValueChange={(value) => setFormData({ ...formData, kategori: value as FinanceCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendapatan">Pendapatan</SelectItem>
                      <SelectItem value="operasional">Operasional</SelectItem>
                      <SelectItem value="gaji">Gaji</SelectItem>
                      <SelectItem value="pajak">Pajak</SelectItem>
                      <SelectItem value="hosting">Hosting</SelectItem>
                      <SelectItem value="iklan">Iklan</SelectItem>
                      <SelectItem value="lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="nominal">Nominal (Rp)</Label>
                  <Input
                    id="nominal"
                    type="number"
                    value={formData.nominal}
                    onChange={(e) => setFormData({ ...formData, nominal: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tanggal">Tanggal</Label>
                  <Input
                    id="tanggal"
                    type="date"
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="keterangan">Keterangan</Label>
                  <Textarea
                    id="keterangan"
                    value={formData.keterangan}
                    onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingFinance ? "Update" : "Simpan"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Filter Section (Pindah ke sini agar tidak tercetak) */}
        <div className="flex flex-wrap items-center justify-between gap-4 print-hide">
            {/* Filter Inputs */}
            <div className="flex gap-2">
                <Input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="max-w-xs"
                />
                <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                    <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Semua Tipe" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Semua Tipe</SelectItem>
                    <SelectItem value="income">Pemasukan</SelectItem>
                    <SelectItem value="expense">Pengeluaran</SelectItem>
                    </SelectContent>
                </Select>
                    <Input
                        placeholder="Cari keterangan..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1"
                    />
            </div>
             {/* Tombol Export */}
             <div className="flex gap-2">
                 <Button onClick={handleExportExcel} variant="secondary" disabled={isLoading || filteredFinances.length === 0}>
                     <FileDown className="mr-2 h-4 w-4" /> Export Excel
                 </Button>
                 <Button onClick={handlePrintReport} variant="outline" disabled={isLoading || filteredFinances.length === 0}>
                      <FileText className="mr-2 h-4 w-4" /> Cetak Laporan PDF
                 </Button>
            </div>
        </div>
        

        {/* Area Laporan yang akan di-capture untuk PDF (Disembunyikan secara default) */}
        <div ref={reportRef} id="printable-report" className="absolute -left-[9999px] -top-[9999px] bg-white p-6 w-[794px]"> {/* A4 width approx 794px */}
            
            {/* Header Laporan untuk PDF */}
            <header className="flex justify-between items-center mb-6 border-b pb-4">
                <div className="flex items-center space-x-4">
                    {(company?.logo_url && !isLoadingCompany) && (
                        <img 
                            src={company.logo_url} 
                            alt="Logo Perusahaan" 
                            className="w-12 h-12 object-contain" 
                        />
                    )}
                    <div>
                        <h1 className="text-xl font-bold">{company?.nama || 'NAMA PERUSAHAAN'}</h1>
                        <p className="text-xs text-gray-600">{company?.alamat || 'Alamat Perusahaan'}</p>
                    </div>
                </div>
                <div className='text-right'>
                    <h2 className="text-lg font-bold">LAPORAN KEUANGAN</h2>
                    <p className="text-sm text-muted-foreground">
                        Periode: {filterMonth.substring(5,7)}/{filterMonth.substring(0,4)}
                        {filterType !== 'all' && ` (${filterType})`}
                    </p>
                </div>
            </header>

            {/* METRIK KEUANGAN (Dipindahkan ke sini) */}
            <div className="grid gap-4 grid-cols-4 mb-6">
              <Card className='shadow-none border-dashed'>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
                </CardContent>
              </Card>
              <Card className='shadow-none border-dashed'>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
                </CardContent>
              </Card>
              <Card className='shadow-none border-dashed'>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Saldo Bersih</CardTitle>
                  <DollarSign className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(balance)}
                  </div>
                </CardContent>
              </Card>
              <Card className='shadow-none border-dashed'>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Simulasi PPh Final (0.5%)</CardTitle>
                  <FileText className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-primary">{formatCurrency(pphFinalAmount)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dari Omzet {formatCurrency(omzetBulanIni)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tabel Riwayat Transaksi untuk PDF */}
            <Card className="shadow-none border-none">
              <CardHeader className="p-0 mb-4">
                 <CardTitle className='text-lg'>Riwayat Transaksi</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                  <div className="rounded-md border">
                    <Table className='text-sm'>
                      <TableHeader className='bg-gray-50'>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Keterangan</TableHead>
                          <TableHead className='text-right'>Pemasukan</TableHead>
                          <TableHead className='text-right'>Pengeluaran</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactionSummary.map((t, index) => (
                          <TableRow key={index} className='text-xs'>
                            <TableCell>{t.tanggal}</TableCell>
                            <TableCell>{t.tipe}</TableCell>
                            <TableCell>{t.kategori}</TableCell>
                            <TableCell className="max-w-xs">{t.keterangan}</TableCell>
                            <TableCell className="font-medium text-right">{formatCurrency(t.income, 0)}</TableCell>
                            <TableCell className="font-medium text-right">{formatCurrency(t.expense, 0)}</TableCell>
                          </TableRow>
                        ))}
                         {/* Baris Total di PDF */}
                          <TableRow className='font-bold bg-gray-100 border-t-2'>
                            <TableCell colSpan={4}>TOTAL</TableCell>
                            <TableCell className='text-right'>{formatCurrency(totalIncome, 0)}</TableCell>
                            <TableCell className='text-right'>{formatCurrency(totalExpense, 0)}</TableCell>
                          </TableRow>
                      </TableBody>
                    </Table>
                  </div>
              </CardContent>
            </Card>
            
            {/* Ringkasan & Tanda Tangan Footer */}
            <div className="mt-8 border-t pt-4 flex justify-between">
                {/* Ringkasan */}
                <div className='w-1/2 space-y-2'>
                    <h3 className='text-md font-semibold'>Ringkasan Bersih</h3>
                    <div className='text-sm'>
                        <div className='flex justify-between'><span>Pemasukan:</span> <span className='font-semibold'>{formatCurrency(totalIncome, 0)}</span></div>
                        <div className='flex justify-between'><span>Pengeluaran:</span> <span className='font-semibold'>{formatCurrency(totalExpense, 0)}</span></div>
                        <div className='flex justify-between border-t pt-1 mt-1 font-bold text-lg'>
                            <span>Saldo Bersih:</span> 
                            <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(balance, 0)}</span>
                        </div>
                    </div>
                </div>

                {/* Tanda Tangan */}
                <div className="w-1/3 text-center space-y-2">
                    <p className='text-sm text-muted-foreground'>Disahkan oleh,</p>
                    {company?.signature_url && (
                        <img 
                            src={company.signature_url} 
                            alt="Tanda Tangan" 
                            className="w-full max-h-16 object-contain mx-auto" 
                            style={{ maxWidth: '120px' }}
                        />
                    )}
                    <p className="border-t pt-1 font-semibold text-sm">({company?.nama || 'Admin/Finance'})</p>
                    <p className="text-xs text-muted-foreground">Dicetak pada: {format(new Date(), 'dd MMMM yyyy', { locale: id })}</p>
                </div>
            </div>

        </div>

        {/* ======================================================= */}
        {/* Tampilan Riwayat Transaksi untuk Dashboard (di luar reportRef) */}
        <Card> 
          <CardHeader>
            <CardTitle>Riwayat Transaksi (Bulan Ini)</CardTitle>
             {/* Filter Inputs (dipindahkan ke atas) */}
          </CardHeader>
          <CardContent>
            {(isLoading || isLoadingCompany) ? (
              <p>Loading...</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Nominal</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="print-hide">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFinances.map((finance) => (
                      <TableRow key={finance.id}>
                        <TableCell>{new Date(finance.tanggal).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell>
                          <Badge className={finance.tipe === 'income' ? 'bg-green-500' : 'bg-red-500'}>
                            {finance.tipe === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                          </Badge>
                        </TableCell>
                        <TableCell>{finance.kategori}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(finance.nominal)}</TableCell>
                        <TableCell className="max-w-xs truncate">{finance.keterangan}</TableCell>
                        <TableCell className="print-hide">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(finance)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(finance.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                   <TableFooter>
                       <TableRow>
                           <TableCell colSpan={3}>Ringkasan Total ({filterMonth})</TableCell>
                           <TableCell className='font-bold text-lg'>{formatCurrency(balance)}</TableCell>
                           <TableCell className='text-muted-foreground'>P: {formatCurrency(totalIncome)} / E: {formatCurrency(totalExpense)}</TableCell>
                           <TableCell className='print-hide'></TableCell>
                       </TableRow>
                   </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Area Info PPh */}
        <Card className='border-blue-500 bg-blue-50'>
             <CardHeader className='flex-row items-center gap-2'><AlertTriangle className='w-5 h-5 text-blue-800'/><CardTitle className='text-lg'>Informasi PPh Final</CardTitle></CardHeader>
             <CardContent className='text-sm space-y-1'>
                 <p>Omzet bulan ini: <span className='font-semibold'>{formatCurrency(omzetBulanIni)}</span></p>
                 <p>Simulasi PPh Final 0.5%: <span className='font-semibold text-primary'>{formatCurrency(pphFinalAmount)}</span></p>
                 <p className='text-xs text-muted-foreground'>* Perhitungan simulasi ini didasarkan pada total Pemasukan (Omzet) yang difilter dan diasumsikan menggunakan tarif PPh Final 0.5% (UMKM).</p>
             </CardContent>
        </Card>


        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
              <AlertDialogDescription>
                Data transaksi ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {/* CSS untuk menyembunyikan elemen saat cetak */}
       <style jsx global>{`
          @media print {
            .print-hide {
              display: none !important;
            }
            /* Menghilangkan semua border dan shadow pada elemen Card di dalam area cetak */
            #printable-report .border {
                border: none !important;
            }
             #printable-report .shadow-none {
                box-shadow: none !important;
            }
            #printable-report {
               position: static !important;
               left: auto !important;
               top: auto !important;
               padding: 0 !important;
               margin: 0 !important;
               background-color: white !important;
            }
            body {
                margin: 0;
            }
            /* Memaksa elemen baris aksi tabel menghilang di media cetak */
            #printable-report .print-hide {
                display: none !important;
            }
            /* Perbaiki tabel di dalam area cetak agar tetap terlihat */
            #printable-report table {
                width: 100% !important;
                border-collapse: collapse;
            }
             #printable-report th, #printable-report td {
                 padding: 8px !important;
                 border: 1px solid #ddd;
             }
             #printable-report thead tr {
                 background-color: #f3f4f6 !important; /* Tailwind gray-100 */
             }
             /* Menghilangkan pagination/scroll area dari elemen tabel yang di-capture */
             #printable-report .overflow-x-auto,
             #printable-report .overflow-y-auto {
                  overflow: visible !important;
             }
             
          }
       `}</style>
    </DashboardLayout>
  );
}