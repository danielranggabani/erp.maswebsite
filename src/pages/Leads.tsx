import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ChevronRight, DollarSign } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadStatus = Database['public']['Enums']['lead_status'];
type LeadSource = Database['public']['Enums']['lead_source'];
type Package = Database['public']['Tables']['packages']['Row']; 

// Query untuk mengambil daftar paket aktif
const usePackagesQuery = () => useQuery({
    queryKey: ['packages-active'],
    queryFn: async () => {
        const { data, error } = await supabase.from('packages').select('*').eq('is_active', true);
        if (error) throw error;
        return data as Package[];
    }
});

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
};


export default function Leads() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // State untuk Konversi
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertFormData, setConvertFormData] = useState({
      packageName: '',
      projectPrice: '',
  });

  const [formData, setFormData] = useState<Partial<LeadInsert>>({
    nama: "",
    kontak: "",
    sumber: "website" as LeadSource,
    status: "baru" as LeadStatus,
    catatan: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: packages = [] } = usePackagesQuery(); 

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Lead[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (newLead: LeadInsert) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(newLead)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: "Lead berhasil ditambahkan" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: "Lead berhasil diupdate" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: "Lead berhasil dihapus" });
      setDeleteId(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // MUTASI UNTUK KONVERSI LEAD BARU - MODIFIED
  const convertMutation = useMutation({
    // Tidak memerlukan argumen id, karena menggunakan state convertingLead
    mutationFn: async () => {
        if (!convertingLead || !convertFormData.packageName || parseFloat(convertFormData.projectPrice) <= 0) {
            throw new Error("Data konversi tidak lengkap atau harga tidak valid.");
        }
        
        const selectedPackage = packages.find(p => p.id === convertFormData.packageName);
        if (!selectedPackage) {
             throw new Error("Paket tidak valid atau tidak aktif.");
        }

        // 1. Ciptakan Client baru
        const { data: clientData, error: clientError } = await supabase.from('clients').insert({
            nama: convertingLead.nama,
            email: convertingLead.kontak.includes('@') ? convertingLead.kontak : null,
            whatsapp: !convertingLead.kontak.includes('@') ? convertingLead.kontak : null,
            bisnis: convertingLead.nama, // Asumsi nama bisnis sama dengan nama lead
            status: 'deal', 
            catatan: `Dikonversi dari Lead. Sumber: ${convertingLead.sumber}.`,
        }).select().single();

        if (clientError) throw clientError;

        // 2. Ciptakan Project baru
        const { data: projectData, error: projectError } = await supabase.from('projects').insert({
            nama_proyek: `Proyek ${convertingLead.nama} (${selectedPackage.nama})`,
            client_id: clientData.id,
            package_id: selectedPackage.id,
            harga: parseFloat(convertFormData.projectPrice),
            status: 'briefing',
            ruang_lingkup: `Proyek website berdasarkan paket yang dipilih: ${selectedPackage.nama}.`,
            estimasi_hari: selectedPackage.estimasi_hari || 7,
        }).select().single();

        if (projectError) throw projectError;

        // 3. Update Status Lead menjadi 'closing' dan hubungkan ke client_id
        const { error: leadUpdateError } = await supabase.from('leads').update({
            status: 'closing' as LeadStatus,
            client_id: clientData.id,
            converted_at: new Date().toISOString(),
        }).eq('id', convertingLead.id);

        if (leadUpdateError) throw leadUpdateError;

        return { client: clientData, project: projectData };
    },
    onSuccess: () => {
        // Invalidate semua query yang terpengaruh
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        toast({ title: "Konversi Berhasil!", description: `Lead ${convertingLead?.nama} telah menjadi Klien dan Proyek baru.` });
        setIsConvertDialogOpen(false);
        setConvertingLead(null);
    },
    onError: (error: any) => {
        toast({ title: "Error Konversi", description: error.message, variant: "destructive" });
    }
  });


  const resetForm = () => {
    setFormData({
      nama: "",
      kontak: "",
      sumber: "website" as LeadSource,
      status: "baru" as LeadStatus,
      catatan: ""
    });
    setEditingLead(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, ...formData });
    } else {
      createMutation.mutate(formData as LeadInsert);
    }
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      nama: lead.nama,
      kontak: lead.kontak,
      sumber: lead.sumber,
      status: lead.status,
      catatan: lead.catatan || ""
    });
    setIsDialogOpen(true);
  };
  
  // Handler untuk Konversi Lead
  const handleConvertLead = (lead: Lead) => {
      setConvertingLead(lead);
      setIsConvertDialogOpen(true);
      // Set nilai default form konversi
      const defaultPackage = packages.length > 0 ? packages[0] : null;
      setConvertFormData({
          packageName: defaultPackage?.id || '',
          projectPrice: defaultPackage?.harga ? String(defaultPackage.harga) : '5000000', 
      });
  };
  
  const handlePackageChange = (packageId: string) => {
      const pkg = packages.find(p => p.id === packageId);
      setConvertFormData({
          packageName: packageId,
          projectPrice: pkg ? String(pkg.harga) : '5000000',
      });
  }


  const filteredLeads = leads.filter(lead =>
    lead.nama.toLowerCase().includes(search.toLowerCase()) ||
    lead.kontak.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: LeadStatus) => {
    const variants: Record<LeadStatus, string> = {
      baru: "bg-blue-500",
      tertarik: "bg-green-500",
      negosiasi: "bg-yellow-500",
      closing: "bg-purple-500",
      gagal: "bg-red-500"
    };
    return <Badge className={variants[status]}>{status}</Badge>;
  };

  const getSumberBadge = (sumber: LeadSource) => {
    return <Badge variant="outline">{sumber}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Lead Management</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Tambah Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLead ? "Edit Lead" : "Tambah Lead Baru"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="nama">Nama</Label>
                  <Input
                    id="nama"
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="kontak">Kontak (WhatsApp/Email)</Label>
                  <Input
                    id="kontak"
                    value={formData.kontak}
                    onChange={(e) => setFormData({ ...formData, kontak: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sumber">Sumber Lead</Label>
                  <Select
                    value={formData.sumber}
                    onValueChange={(value) => setFormData({ ...formData, sumber: value as LeadSource })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="google">Google Ads</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baru">Baru</SelectItem>
                      <SelectItem value="tertarik">Tertarik</SelectItem>
                      <SelectItem value="negosiasi">Negosiasi</SelectItem>
                      <SelectItem value="closing">Closing</SelectItem>
                      <SelectItem value="gagal">Gagal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="catatan">Catatan</Label>
                  <Textarea
                    id="catatan"
                    value={formData.catatan}
                    onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingLead ? "Update" : "Simpan"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Leads</CardTitle>
            <Input
              placeholder="Cari leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading...</p>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kontak</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead className='min-w-[150px]'>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.nama}</TableCell>
                        <TableCell>{lead.kontak}</TableCell>
                        <TableCell>{getSumberBadge(lead.sumber)}</TableCell>
                        <TableCell>{getStatusBadge(lead.status!)}</TableCell>
                        <TableCell className="max-w-xs truncate">{lead.catatan}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                              {/* Tombol Konversi (Hanya muncul jika status belum Closing/Gagal) */}
                              {lead.status !== 'closing' && lead.status !== 'gagal' && (
                                  <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleConvertLead(lead)}
                                      title="Convert to Client & Project"
                                      disabled={convertMutation.isPending}
                                  >
                                      <ChevronRight className="h-4 w-4 mr-1" /> Convert
                                  </Button>
                              )}

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(lead)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(lead.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DIALOG KONVERSI LEAD */}
        <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Konversi Lead ke Proyek</DialogTitle>
                </DialogHeader>
                <form 
                    onSubmit={(e) => { 
                        e.preventDefault(); 
                        convertMutation.mutate(undefined as any); // Memanggil mutation tanpa argumen (data diambil dari state)
                    }} 
                    className="space-y-4"
                >
                    <p className="text-sm">Konversi **{convertingLead?.nama}** menjadi Klien baru dan buatkan Proyek pertamanya. </p>

                    <div className="space-y-2">
                        <Label htmlFor="package">Pilih Paket Website *</Label>
                        <Select required value={convertFormData.packageName} onValueChange={handlePackageChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih paket" />
                            </SelectTrigger>
                            <SelectContent>
                                {packages.length === 0 && <SelectItem value="" disabled>No Active Packages</SelectItem>}
                                {packages.map((pkg) => (
                                    <SelectItem key={pkg.id} value={pkg.id!}>
                                        {pkg.nama} ({formatCurrency(Number(pkg.harga))})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="price">Harga Proyek</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="price"
                                type="number"
                                placeholder="Harga Proyek"
                                className="pl-8"
                                value={convertFormData.projectPrice}
                                onChange={(e) => setConvertFormData({ ...convertFormData, projectPrice: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsConvertDialogOpen(false)}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={convertMutation.isPending || !convertFormData.packageName}>
                            {convertMutation.isPending ? 'Mengkonversi...' : 'Konversi & Buat Proyek'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>


        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Lead?</AlertDialogTitle>
              <AlertDialogDescription>
                Data lead ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
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
    </DashboardLayout>
  );
}