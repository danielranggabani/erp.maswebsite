import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Check, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Database } from '@/integrations/supabase/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type Package = Database['public']['Tables']['packages']['Row'];
type PackageInsert = Database['public']['Tables']['packages']['Insert'];

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
};

// ======================= DATA HOOK =======================
const usePackageData = () => {
    return useQuery({
        queryKey: ['packages'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('packages')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Package[];
        },
    });
}
// =========================================================


export default function Packages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: packages = [], isLoading } = usePackageData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);

  // State untuk AlertDialog Hapus
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);

  const [formData, setFormData] = useState({
    nama: '',
    harga: '',
    deskripsi: '',
    fitur: '[]', // Default ke string array JSON kosong
    estimasi_hari: '',
    is_active: true,
  });

  const packageMutation = useMutation({
    mutationFn: async (data: Partial<PackageInsert> & { id?: string }) => {
        let fiturJson = null;
        try {
            // Coba parse JSON, pastikan tidak error jika input kosong atau tidak valid
            if (data.fitur && typeof data.fitur === 'string' && data.fitur.trim()) {
                 fiturJson = JSON.parse(data.fitur);
                 if (!Array.isArray(fiturJson)) {
                      throw new Error("Format Fitur harus berupa array JSON, contoh: [\"Fitur A\", \"Fitur B\"]");
                 }
            } else {
                fiturJson = []; // Default ke array kosong jika input kosong
            }
        } catch (e: any) {
            console.error("JSON Parse Error:", e);
            throw new Error(`Format Fitur tidak valid: ${e.message}. Contoh: ["Fitur A", "Fitur B"]`);
        }

        const packageData: Partial<PackageInsert> = {
            nama: data.nama,
            harga: parseFloat(data.harga?.toString() || '0'),
            deskripsi: data.deskripsi || null,
            fitur: fiturJson,
            estimasi_hari: data.estimasi_hari ? parseInt(data.estimasi_hari.toString()) : null,
            is_active: data.is_active,
        };

        if (data.id) {
            const { error } = await supabase
                .from('packages')
                .update(packageData)
                .eq('id', data.id);
            if (error) throw error;
        } else {
             // Pastikan field wajib ada saat insert
             if (!packageData.nama || packageData.harga == null) {
                  throw new Error("Nama paket dan Harga wajib diisi.");
             }
            const { error } = await supabase.from('packages').insert(packageData as PackageInsert);
            if (error) throw error;
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['packages'] });
        queryClient.invalidateQueries({ queryKey: ['packages-active'] });
        toast({ title: editingPackage ? 'Paket berhasil diupdate' : 'Paket berhasil dibuat' });
        setDialogOpen(false);
        resetForm();
    },
    onError: (error: any) => {
        toast({
            title: 'Error Simpan Paket',
            description: error.message,
            variant: 'destructive'
        });
    }
  });


  const handleDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages-active'] });
      toast({ title: 'Paket berhasil dihapus' });
       setPackageToDelete(null); // Tutup dialog konfirmasi
    },
    onError: (error: any) => {
        toast({ title: 'Error Hapus Paket', description: error.message, variant: 'destructive' });
         setPackageToDelete(null); // Tutup dialog konfirmasi walau error
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parseFloat(formData.harga)) || parseFloat(formData.harga) <= 0) {
        toast({ title: 'Error', description: 'Harga harus berupa angka positif.', variant: 'destructive' });
        return;
    }

    packageMutation.mutate({ ...formData, id: editingPackage?.id });
  };

  // Fungsi untuk membuka dialog konfirmasi hapus
  const confirmDelete = (pkg: Package) => {
      setPackageToDelete(pkg);
  };

  // Fungsi yang dipanggil saat tombol Hapus di AlertDialog diklik
  const executeDelete = () => {
      if (packageToDelete) {
          handleDeleteMutation.mutate(packageToDelete.id);
      }
  };

  const resetForm = () => {
    setFormData({
      nama: '',
      harga: '',
      deskripsi: '',
      fitur: '[]', // Reset ke string array JSON kosong
      estimasi_hari: '',
      is_active: true,
    });
    setEditingPackage(null);
  };

  const openEditDialog = (pkg: Package) => {
    setEditingPackage(pkg);
    setFormData({
      nama: pkg.nama,
      harga: pkg.harga.toString(),
      deskripsi: pkg.deskripsi || '',
      fitur: pkg.fitur ? JSON.stringify(pkg.fitur, null, 2) : '[]', // Format JSON untuk diedit
      estimasi_hari: pkg.estimasi_hari?.toString() || '',
      is_active: pkg.is_active ?? true, // Handle null case for is_active
    });
    setDialogOpen(true);
  };

  const parseFitur = (fitur: any): string[] => {
    if (Array.isArray(fitur)) return fitur.map(f => String(f));
    if (typeof fitur === 'string') {
        try {
            const parsed = JSON.parse(fitur);
            if (Array.isArray(parsed)) return parsed.map(f => String(f));
        } catch (e) {}
    }
    return [];
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Paket Website</h2>
            <p className="text-muted-foreground">
              Kelola penawaran paket website Anda
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm(); // Reset form saat dialog ditutup
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingPackage(null); resetForm(); }}> {/* Pastikan reset form saat buka dialog baru */}
                <PlusCircle className="mr-2 h-4 w-4" />
                Buat Paket Baru
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPackage ? 'Edit Paket' : 'Buat Paket Baru'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4"> {/* Tambah scroll */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nama">Nama Paket *</Label>
                    <Input
                      id="nama"
                      value={formData.nama}
                      onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="harga">Harga (Rp) *</Label>
                    <Input
                      id="harga"
                      type="number"
                      value={formData.harga}
                      onChange={(e) => setFormData({ ...formData, harga: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deskripsi">Deskripsi</Label>
                  <Textarea
                    id="deskripsi"
                    value={formData.deskripsi}
                    onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fitur">Fitur (Format JSON Array)</Label>
                  <Textarea
                    id="fitur"
                    value={formData.fitur}
                    onChange={(e) => setFormData({ ...formData, fitur: e.target.value })}
                    placeholder='Contoh: ["Gratis Domain .com", "SSL Gratis", "5 Halaman Website"]'
                    rows={4}
                  />
                  <p className='text-xs text-muted-foreground'>* Wajib dalam format JSON Array: ["item1", "item2"]. Kosongkan jika tidak ada.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimasi_hari">Estimasi Hari Pengerjaan</Label>
                      <Input
                        id="estimasi_hari"
                        type="number"
                        value={formData.estimasi_hari}
                        onChange={(e) => setFormData({ ...formData, estimasi_hari: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Paket Aktif</Label>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Batal
                    </Button>
                    <Button type="submit" disabled={packageMutation.isPending}>
                        {packageMutation.isPending ? 'Memproses...' : (editingPackage ? 'Update Paket' : 'Buat Paket')}
                    </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <p className="col-span-full text-center text-muted-foreground">Memuat paket...</p>
          ) : packages.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground">Belum ada paket dibuat.</p>
          ) : (
            packages.map((pkg) => (
              <Card key={pkg.id} className={`flex flex-col ${!pkg.is_active ? 'opacity-60' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{pkg.nama}</CardTitle>
                      <CardDescription className="mt-2 text-lg font-semibold text-primary">
                        {formatCurrency(Number(pkg.harga))}
                      </CardDescription>
                    </div>
                    <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                      {pkg.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col"> {/* Flex grow */}
                  <p className="text-sm text-muted-foreground flex-1">{pkg.deskripsi}</p> {/* Flex grow */}
                  {pkg.estimasi_hari && (
                    <p className="text-sm">
                      <strong>Estimasi:</strong> {pkg.estimasi_hari} hari
                    </p>
                  )}
                  {pkg.fitur && parseFitur(pkg.fitur).length > 0 && (
                    <ul className="space-y-1.5 pt-2 border-t mt-auto"> {/* mt-auto */}
                     <Label className="text-xs text-muted-foreground">Fitur Utama:</Label>
                      {parseFitur(pkg.fitur).map((feature, idx) => (
                        <li key={idx} className="flex items-start text-sm">
                          <Check className="mr-2 h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span className='flex-1'>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Pindahkan tombol ke bawah */}
                   <div className="flex gap-2 pt-4 border-t mt-auto"> {/* mt-auto */}
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(pkg)} title="Edit Paket">
                      <Pencil className="h-4 w-4" />
                    </Button>
                     {/* Tombol Hapus sekarang memicu AlertDialog */}
                    <Button
                      size="sm"
                      variant="ghost" // Ganti ke ghost untuk konsistensi
                      onClick={() => confirmDelete(pkg)} // Panggil confirmDelete
                      title="Hapus Paket"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={handleDeleteMutation.isPending && packageToDelete?.id === pkg.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

         {/* AlertDialog untuk Konfirmasi Hapus Paket */}
         <AlertDialog open={!!packageToDelete} onOpenChange={() => setPackageToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Hapus Paket?</AlertDialogTitle>
                <AlertDialogDescription>
                    Anda yakin ingin menghapus paket "{packageToDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                    onClick={executeDelete}
                    disabled={handleDeleteMutation.isPending}
                     className={buttonVariants({ variant: "destructive" })}
                >
                    {handleDeleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus Paket'}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </div>
    </DashboardLayout>
  );
}