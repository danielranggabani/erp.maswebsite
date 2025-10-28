// src/pages/Settings.tsx

import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Save, Upload, AlertTriangle, Loader2 } from "lucide-react";
import React, { useState, useEffect } from "react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { useRoles } from '@/hooks/useRoles';

// --- Tipe Data ---
type Company = Database['public']['Tables']['companies']['Row'];
// [MODIFIKASI] Hapus NPWP, Tambah PhonePerusahaan
type CompanyInsert = Pick<Database['public']['Tables']['companies']['Insert'], 'nama' | 'alamat' | 'rekening' | 'logo_url' | 'signature_url'> & { phone_perusahaan?: string | null };
type CompanyUpdate = Pick<Database['public']['Tables']['companies']['Update'], 'nama' | 'alamat' | 'rekening' | 'logo_url' | 'signature_url'> & { phone_perusahaan?: string | null };


// --- Utility: Upload File ---
const uploadFileToSupabase = async (file: File, path: string): Promise<string> => {
  const MAX_SIZE = 3 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("Ukuran file tidak boleh lebih dari 3MB.");
  }
  
  const filePath = `${path}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;

  // 1. Upload file ke Supabase Storage (Asumsi nama bucket: 'documents')
  const { error: uploadError } = await supabase.storage
    .from('documents') 
    .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true 
    });
    
  if (uploadError) {
    console.error('Supabase Upload Error:', uploadError);
    throw new Error(`Gagal mengunggah file: ${uploadError.message}`);
  }

  // 2. Dapatkan URL publik
  const { data: publicUrlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  if (!publicUrlData.publicUrl) {
    throw new Error("Gagal mendapatkan URL publik untuk file yang diunggah.");
  }
  
  return publicUrlData.publicUrl; 
};


// --- Hook Data & Mutasi Company (Untuk Admin) ---
const useCompanySettings = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const companyQuery = useQuery({
        queryKey: ['company'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('companies')
                // [MODIFIKASI] Tambahkan phone_perusahaan
                .select('id, nama, alamat, rekening, logo_url, signature_url, phone_perusahaan')
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data as Company | null;
        }
    });

    const updateCompanyMutation = useMutation({
        mutationFn: async (updates: CompanyUpdate) => {
            const company = companyQuery.data;
            if (company?.id) {
                const { error } = await supabase
                    .from('companies')
                    .update(updates)
                    .eq('id', company.id)
                    .select()
                    .single();
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('companies')
                    .insert(updates as CompanyInsert) // Insert full object
                    .select()
                    .single();
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['company'] });
            toast({ title: "Pengaturan berhasil disimpan" });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    // Mengembalikan nama mutasi yang jelas
    return { company: companyQuery.data, isCompanyLoading: companyQuery.isLoading, updateCompanyMutation };
};


// --- Komponen Utama Settings (Routing Berdasarkan Role) ---
export default function Settings() {
    const { roles, isLoading: rolesLoading } = useRoles();
    const { company, isCompanyLoading, updateCompanyMutation } = useCompanySettings(); // Destructuring mutasi
    const { toast } = useToast();

    // State untuk form perusahaan
    const [formData, setFormData] = useState<CompanyUpdate>({
        nama: "",
        alamat: "",
        rekening: "",
        logo_url: "",
        signature_url: "",
        phone_perusahaan: ""
    });

    // Cek Role
    const isAdmin = roles.includes('admin');
    const isLoading = rolesLoading || isCompanyLoading;

    useEffect(() => {
        if (company) {
            setFormData({
                nama: company.nama,
                alamat: company.alamat || "",
                rekening: company.rekening || "",
                logo_url: company.logo_url || "",
                signature_url: company.signature_url || "",
                phone_perusahaan: (company as any).phone_perusahaan || "" 
            });
        }
    }, [company]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const cleanPhone = formData.phone_perusahaan?.replace(/[^0-9]/g, '');
        
        // Validasi WA Perusahaan (wajib 62 jika diisi)
        if (cleanPhone && !cleanPhone.startsWith('62')) {
            return toast({ title: "Validasi Gagal", description: "Nomor Telepon Perusahaan harus diawali dengan 62.", variant: "destructive" });
        }

        // Kirim semua field teks sekaligus
        updateCompanyMutation.mutate({ ...formData, phone_perusahaan: cleanPhone });
    };
    
    // Handler untuk File Upload (digunakan untuk logo dan tanda tangan)
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: keyof CompanyUpdate, path: string) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const url = await uploadFileToSupabase(file, path); 
                setFormData(prev => ({ ...prev, [field]: url }));
                toast({ title: "Upload Berhasil", description: "File berhasil diunggah dan disimpan di formulir." });
                
                // [FIX] Menggunakan updateCompanyMutation
                updateCompanyMutation.mutate({ ...formData, [field]: url });

            } catch (error: any) {
                toast({ title: "Error Upload", description: error.message, variant: "destructive" });
            }
        }
    };


    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="container mx-auto p-6 space-y-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p>Memuat pengaturan...</p>
                </div>
            </DashboardLayout>
        );
    }
    
    // Akses Ditolak untuk Non-Admin (Mereka akan diarahkan ke /profile)
    if (!isAdmin) {
         return (
            <DashboardLayout>
                <div className="container p-6 space-y-4 text-center">
                    <AlertTriangle className="mx-auto h-10 w-10 mb-2 text-yellow-600" />
                    <h2 className="text-2xl font-bold">Akses Terbatas</h2>
                    <p className="text-muted-foreground">Pengaturan Perusahaan hanya bisa diakses oleh Admin. Silakan kelola profil pribadi Anda di halaman **<a href="/profile" className="text-primary hover:underline">/profile</a>**.</p>
                    <Button onClick={() => window.location.href = '/profile'}>Ke Halaman Profil</Button>
                </div>
            </DashboardLayout>
         );
    }


    // Tampilkan Pengaturan Perusahaan untuk ADMIN
    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center gap-2">
                    <Building2 className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">Pengaturan Perusahaan (Admin)</h1>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Informasi Perusahaan</CardTitle>
                        <CardDescription>Data perusahaan akan digunakan di SPK dan Invoice</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="nama">Nama Perusahaan</Label>
                                <Input
                                    id="nama"
                                    value={formData.nama}
                                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                                    required
                                />
                            </div>

                            {/* [MODIFIKASI] Nomor Telepon Perusahaan */}
                            <div>
                                <Label htmlFor="phone_perusahaan">Nomor Telepon Perusahaan (Untuk WA Notifikasi/SPK)</Label>
                                <Input
                                    id="phone_perusahaan"
                                    type="tel"
                                    value={formData.phone_perusahaan || ''}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/[^0-9]/g, ''); // Hanya angka
                                        setFormData({ ...formData, phone_perusahaan: value });
                                    }}
                                    placeholder="Harus diawali 62, Contoh: 62812xxxx"
                                />
                            </div>

                            <div>
                                <Label htmlFor="rekening">Nomor Rekening</Label>
                                <Input
                                    id="rekening"
                                    value={formData.rekening || ''}
                                    onChange={(e) => setFormData({ ...formData, rekening: e.target.value })}
                                    placeholder="Bank BCA - 1234567890 a.n. PT Example"
                                />
                            </div>

                            <div>
                                <Label htmlFor="alamat">Alamat</Label>
                                <Textarea
                                    id="alamat"
                                    value={formData.alamat || ''}
                                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                                    rows={3}
                                />
                            </div>


                            <div className="flex justify-end">
                                <Button type="submit" disabled={updateCompanyMutation.isPending}>
                                    <Save className="mr-2 h-4 w-4" />
                                    {updateCompanyMutation.isPending ? "Menyimpan..." : "Simpan Informasi Perusahaan"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* LOGIKA UPLOAD FILE BARU */}
                <Card>
                    <CardHeader>
                        <CardTitle>Logo & Tanda Tangan</CardTitle>
                        <CardDescription>Upload logo (max 3MB) dan tanda tangan digital (.png transparan, max 3MB).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={handleSubmit}> 
                            {/* LOGO UPLOAD */}
                            <div className="space-y-2">
                                <Label htmlFor="logo_upload">Logo Perusahaan (.png/.jpg)</Label>
                                <div className="flex items-center space-x-2">
                                    <Input 
                                        id="logo_upload" 
                                        type="file" 
                                        accept="image/png,image/jpeg" 
                                        onChange={(e) => handleFileUpload(e, 'logo_url', 'company/logo')}
                                        className="flex-1"
                                    />
                                    {formData.logo_url && (
                                        <a href={formData.logo_url} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline" size="icon" type="button" title="Lihat Logo Terunggah">
                                                <Upload className="h-4 w-4" />
                                            </Button>
                                        </a>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    URL Tersimpan: {formData.logo_url ? 'Sudah terunggah' : 'Belum ada'}
                                </p>
                            </div>

                            {/* TANDA TANGAN UPLOAD */}
                            <div className="space-y-2">
                                <Label htmlFor="signature_upload">Tanda Tangan Digital (.png transparan)</Label>
                                <div className="flex items-center space-x-2">
                                    <Input 
                                        id="signature_upload" 
                                        type="file" 
                                        accept="image/png" 
                                        onChange={(e) => handleFileUpload(e, 'signature_url', 'company/signature')}
                                        className="flex-1"
                                    />
                                    {formData.signature_url && (
                                        <a href={formData.signature_url} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline" size="icon" type="button" title="Lihat Tanda Tangan Terunggah">
                                                <Upload className="h-4 w-4" />
                                            </Button>
                                        </a>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    URL Tersimpan: {formData.signature_url ? 'Sudah terunggah' : 'Belum ada'}
                                </p>
                            </div>
                            
                            <div className="flex justify-end">
                                <Button type="submit" disabled={updateCompanyMutation.isPending}>
                                    <Save className="mr-2 h-4 w-4" />
                                    {updateCompanyMutation.isPending ? "Menyimpan..." : "Simpan URL Perubahan Lain"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}