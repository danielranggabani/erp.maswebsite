// src/pages/Profile.tsx

import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, User, Loader2, AlertTriangle } from "lucide-react";
import React, { useState, useEffect } from "react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from '@/lib/auth';

// --- Tipe Data ---
type ProfileUpdate = Pick<Database['public']['Tables']['profiles']['Update'], 'full_name' | 'phone'>;
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

// --- Hook Data & Mutasi Profile User ---
const useUserProfile = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Query untuk mengambil nama dan nomor WA
    const profileQuery = useQuery({
        queryKey: ['userProfile', user?.id],
        queryFn: async () => {
            if (!user) throw new Error("User not authenticated.");
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, phone')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            return data as ProfileUpdate;
        },
        enabled: !!user,
    });

    // Mutasi untuk update nama dan WA
    const updateProfileMutation = useMutation({
        mutationFn: async (formData: ProfileUpdate) => {
            if (!user) throw new Error("User not authenticated.");

            // Validasi dan pembersihan nomor telepon
            const cleanPhone = formData.phone?.replace(/[^0-9]/g, '');
            if (!cleanPhone || !cleanPhone.startsWith('62')) {
                 throw new Error("Nomor WhatsApp harus diisi dan diawali dengan 62 (contoh: 62812xxxx).");
            }

            const { error } = await supabase
                .from('profiles')
                .update({ full_name: formData.full_name, phone: cleanPhone })
                .eq('id', user.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['currentAuth'] }); // Refresh nama di sidebar
            toast({ title: "Sukses", description: "Profil dan Nomor WA berhasil diperbarui." });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    return { profile: profileQuery.data, isProfileLoading: profileQuery.isLoading, updateProfileMutation };
};

// --- Komponen Utama Profile ---
export default function Profile() {
    const { profile, isProfileLoading, updateProfileMutation } = useUserProfile();
    const { toast } = useToast();

    const [formData, setFormData] = useState<ProfileUpdate>({ full_name: '', phone: '' });

    useEffect(() => {
        if (profile) {
            setFormData({ full_name: profile.full_name || '', phone: profile.phone || '' });
        }
    }, [profile]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfileMutation.mutate(formData);
    };

    if (isProfileLoading) {
        return (
            <DashboardLayout>
                <div className="container mx-auto p-6 space-y-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p>Memuat profil...</p>
                </div>
            </DashboardLayout>
        );
    }
    
    // Tampilkan error jika data gagal dimuat (misal: user belum login)
    if (!profile) {
         return (
             <DashboardLayout>
                <div className="container p-6 text-center text-red-600">
                    <AlertTriangle className="mx-auto h-10 w-10 mb-2" /> 
                    <p>Gagal memuat data profil. Pastikan Anda sudah login.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center gap-2">
                    <User className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">Pengaturan Profil Pribadi</h1>
                </div>

                <Card className="max-w-xl mx-auto">
                    <CardHeader>
                        <CardTitle>Data Pribadi & Notifikasi WhatsApp</CardTitle>
                        <CardDescription>Perbarui nama dan nomor WhatsApp Anda untuk notifikasi otomatis dari sistem (misalnya penugasan proyek dan pembayaran fee).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="full_name">Nama Lengkap</Label>
                                <Input 
                                    id="full_name" 
                                    value={formData.full_name} 
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} 
                                    required 
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="phone">Nomor WhatsApp (Wajib: 62xxxx)</Label>
                                <Input 
                                    id="phone" 
                                    type="tel" 
                                    placeholder="Contoh: 6281234567890" 
                                    value={formData.phone} 
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/[^0-9]/g, '');
                                        setFormData({ ...formData, phone: value });
                                    }}
                                    required 
                                />
                                <p className="text-xs text-muted-foreground">Nomor harus diawali **62** dan hanya berisi angka. Digunakan untuk notifikasi Fonnte.</p>
                            </div>

                            <Button type="submit" disabled={updateProfileMutation.isPending}>
                                <Save className="mr-2 h-4 w-4" />
                                {updateProfileMutation.isPending ? 'Menyimpan...' : 'Simpan Profil'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}