import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    AlertDialogTrigger, // Trigger bisa digunakan langsung pada tombol hapus
} from "@/components/ui/alert-dialog";
import { PlusCircle, Search, Pencil, Trash2, MessageCircle, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { Separator } from '@/components/ui/separator';

// Definisikan Tipe Data dari Supabase
type Client = Database['public']['Tables']['clients']['Row'] & { alamat: string | null };
type ClientInsert = Database['public']['Tables']['clients']['Insert'] & { alamat: string | null };
type Communication = Database['public']['Tables']['communications']['Row'];
type CommunicationInsert = Database['public']['Tables']['communications']['Insert'];

const statusColors = {
    prospek: 'bg-blue-500',
    negosiasi: 'bg-yellow-500',
    deal: 'bg-green-500',
    aktif: 'bg-emerald-500',
    selesai: 'bg-gray-500',
};

const initialClientFormData: Partial<ClientInsert> = {
    nama: '',
    email: '',
    phone: '',
    whatsapp: '',
    bisnis: '',
    status: 'prospek',
    catatan: '',
    renewal_date: null,
    alamat: null,
}

// ======================= HOOKS UNTUK RIWAYAT KOMUNIKASI =======================
const useCommunicationMutations = (clientId: string | null) => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['client-communications', clientId] });

    const createCommunicationMutation = useMutation({
        mutationFn: async (data: CommunicationInsert) => {
            const { error } = await supabase.from('communications').insert([data]);
            if (error) throw error;
        },
        onSuccess: () => {
            invalidate();
            toast({ title: 'Komunikasi berhasil ditambahkan' });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    return { createCommunicationMutation };
}

// ======================= KOMPONEN UTAMA CLIENTS =======================
export default function Clients() {
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [clientFormData, setClientFormData] = useState<Partial<ClientInsert>>(initialClientFormData);

    // Communication History State
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);
    const [newCommunication, setNewCommunication] = useState<Partial<CommunicationInsert>>({
        subject: '',
        notes: '',
        follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    });

    // State untuk AlertDialog Hapus
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

    // Query Utama untuk Data Klien
    const { data: clients, isLoading } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Client[];
        },
        onError: (error) => {
            console.error("Client Fetch Error:", error);
            toast({ title: "Error", description: "Gagal memuat data klien (Cek RLS).", variant: "destructive" });
        }
    });

    // Query untuk Riwayat Komunikasi Klien yang dipilih
    const { data: communications = [], isLoading: isLoadingCommunications } = useQuery({
        queryKey: ['client-communications', selectedClientForHistory?.id],
        queryFn: async () => {
            if (!selectedClientForHistory?.id) return [];
            const { data, error } = await supabase
                .from('communications')
                .select('*')
                .eq('client_id', selectedClientForHistory.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as Communication[];
        },
        enabled: !!selectedClientForHistory?.id && isHistoryDialogOpen,
    });

    const { createCommunicationMutation } = useCommunicationMutations(selectedClientForHistory?.id || null);


    // --- MUTASI UTAMA CLIENTS ---
    const createMutation = useMutation({
        mutationFn: async (data: ClientInsert) => {
            const { error } = await supabase.from('clients').insert([data]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            toast({ title: 'Klien berhasil dibuat' });
            setIsDialogOpen(false);
            resetClientForm();
        },
        onError: (error: any) => {
            toast({ title: 'Error Membuat Klien', description: error.message, variant: 'destructive' });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<ClientInsert> }) => {
            const { error } = await supabase.from('clients').update(data).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            toast({ title: 'Klien berhasil diupdate' });
            setIsDialogOpen(false);
            resetClientForm();
        },
        onError: (error: any) => {
            toast({ title: 'Error Update Klien', description: error.message, variant: 'destructive' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            // Tambahkan: Hapus riwayat komunikasi terkait sebelum hapus klien
            const { error: commsError } = await supabase.from('communications').delete().eq('client_id', id);
            if (commsError) console.warn("Could not delete communications for client:", commsError.message);

            // Tambahkan: Hapus leads terkait (jika perlu, atau set client_id jadi null)
            const { error: leadsError } = await supabase.from('leads').update({ client_id: null }).eq('client_id', id);
             if (leadsError) console.warn("Could not nullify client_id in leads:", leadsError.message);

            // Hapus klien
            const { error } = await supabase.from('clients').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            toast({ title: 'Klien berhasil dihapus' });
            setClientToDelete(null); // Tutup dialog konfirmasi
        },
        onError: (error: any) => {
            toast({ title: 'Error Hapus Klien', description: `Gagal menghapus: ${error.message}. Pastikan tidak ada Proyek/Invoice terkait.`, variant: 'destructive' });
             setClientToDelete(null); // Tutup dialog konfirmasi walau error
        },
    });


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingClient) {
            updateMutation.mutate({ id: editingClient.id, data: clientFormData });
        } else {
            createMutation.mutate(clientFormData as ClientInsert);
        }
    };

    const handleEdit = (client: Client) => {
        setEditingClient(client);
        setClientFormData({
            nama: client.nama,
            email: client.email,
            phone: client.phone,
            whatsapp: client.whatsapp,
            bisnis: client.bisnis,
            status: client.status,
            catatan: client.catatan,
            renewal_date: client.renewal_date || '',
            alamat: client.alamat,
        });
        setIsDialogOpen(true);
    };

    // Fungsi untuk membuka dialog konfirmasi hapus
    const confirmDelete = (client: Client) => {
        setClientToDelete(client);
    };

    // Fungsi yang dipanggil saat tombol Hapus di AlertDialog diklik
    const executeDelete = () => {
        if (clientToDelete) {
            deleteMutation.mutate(clientToDelete.id);
        }
    };

    const resetClientForm = () => {
        setClientFormData(initialClientFormData);
        setEditingClient(null);
    };

    // --- COMMUNICATION HISTORY HANDLERS ---
    const openHistoryDialog = (client: Client) => {
        setSelectedClientForHistory(client);
        setIsHistoryDialogOpen(true);
        resetCommunicationForm();
    }

    const resetCommunicationForm = () => {
        setNewCommunication({
            subject: '',
            notes: '',
            follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
        });
    }

    const handleAddCommunication = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientForHistory?.id || !newCommunication.notes) {
            toast({ title: 'Error', description: 'Catatan harus diisi.', variant: 'destructive' });
            return;
        }

        const newRecord: CommunicationInsert = {
            client_id: selectedClientForHistory.id,
            subject: newCommunication.subject || null,
            notes: newCommunication.notes,
            follow_up_date: newCommunication.follow_up_date || null,
            created_by: supabase.auth.getUser() ? supabase.auth.getUser().then(u => u.data.user?.id) : undefined // Assign current user
        };

        createCommunicationMutation.mutate(newRecord, {
            onSuccess: () => {
                resetCommunicationForm();
                if (selectedClientForHistory.status === 'prospek') {
                    updateMutation.mutate({ id: selectedClientForHistory.id, data: { status: 'negosiasi' } });
                }
            }
        });
    }
    // --- END COMMUNICATION HISTORY HANDLERS ---


    const filteredClients = clients?.filter(client =>
        client.nama?.toLowerCase().includes(search.toLowerCase()) ||
        client.email?.toLowerCase().includes(search.toLowerCase()) ||
        client.bisnis?.toLowerCase().includes(search.toLowerCase())
    );

    const getRenewalStatus = (dateString: string | null) => {
        if (!dateString) return null;
        const renewalDate = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        renewalDate.setHours(0, 0, 0, 0);

        const diffTime = renewalDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: 'EXPIRED', color: 'bg-red-600' };
        if (diffDays <= 30) return { text: `${diffDays} HARI LAGI`, color: 'bg-orange-600' };

        const yyyy = renewalDate.getFullYear();
        const mm = String(renewalDate.getMonth() + 1).padStart(2, '0');
        const dd = String(renewalDate.getDate()).padStart(2, '0');

        return { text: `${dd}/${mm}/${yyyy}`, color: 'bg-blue-600' };
    }


    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                {/* Header (Client CRUD Dialog) */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Clients</h2>
                        <p className="text-muted-foreground">
                            Kelola database klien dan relasi Anda
                        </p>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) resetClientForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Tambah Klien
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingClient ? 'Edit Klien' : 'Tambah Klien Baru'}</DialogTitle>
                                <DialogDescription>
                                    {editingClient ? 'Perbarui informasi klien' : 'Masukkan detail klien untuk ditambahkan ke CRM Anda'}
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit}>
                                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4"> {/* Tambah scroll */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="nama">Nama *</Label>
                                            <Input
                                                id="nama"
                                                value={clientFormData.nama || ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, nama: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={clientFormData.email || ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="phone">Telepon</Label>
                                            <Input
                                                id="phone"
                                                value={clientFormData.phone || ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="whatsapp">WhatsApp</Label>
                                            <Input
                                                id="whatsapp"
                                                value={clientFormData.whatsapp || ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, whatsapp: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="alamat">Alamat Klien (Untuk SPK)</Label>
                                        <Textarea
                                            id="alamat"
                                            placeholder="Masukkan alamat lengkap klien untuk dokumen resmi"
                                            value={clientFormData.alamat || ''}
                                            onChange={(e) => setClientFormData({ ...clientFormData, alamat: e.target.value })}
                                            rows={2}
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="bisnis">Bisnis</Label>
                                            <Input
                                                id="bisnis"
                                                value={clientFormData.bisnis || ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, bisnis: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="status">Status</Label>
                                            <Select
                                                value={clientFormData.status}
                                                onValueChange={(value) => setClientFormData({ ...clientFormData, status: value as any })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="prospek">Prospek</SelectItem>
                                                    <SelectItem value="negosiasi">Negosiasi</SelectItem>
                                                    <SelectItem value="deal">Deal</SelectItem>
                                                    <SelectItem value="aktif">Aktif</SelectItem>
                                                    <SelectItem value="selesai">Selesai</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="renewal_date">Tanggal Renewal</Label>
                                            <Input
                                                id="renewal_date"
                                                type="date"
                                                value={clientFormData.renewal_date ? clientFormData.renewal_date.toString() : ''}
                                                onChange={(e) => setClientFormData({ ...clientFormData, renewal_date: e.target.value || null })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="catatan">Catatan</Label>
                                        <Textarea
                                            id="catatan"
                                            value={clientFormData.catatan || ''}
                                            onChange={(e) => setClientFormData({ ...clientFormData, catatan: e.target.value })}
                                            rows={3}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                        {editingClient ? 'Update Klien' : 'Tambah Klien'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Client List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Klien</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari klien berdasarkan nama, email, atau bisnis..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[250px]">Nama & Kontak</TableHead>
                                        <TableHead>Bisnis</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Renewal</TableHead>
                                        <TableHead className="text-right min-w-[150px]">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Memuat...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredClients && filteredClients.length > 0 ? (
                                        filteredClients.map((client) => {
                                            const renewalStatus = getRenewalStatus(client.renewal_date);
                                            return (
                                                <TableRow key={client.id}>
                                                    <TableCell className="font-medium">
                                                        <div className='font-semibold'>{client.nama}</div>
                                                        <div className='text-xs text-muted-foreground mt-1'>
                                                            {client.alamat || '-'}
                                                        </div>
                                                        <div className='text-xs text-muted-foreground'>
                                                            {client.email || '-'} | {client.whatsapp || client.phone || '-'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{client.bisnis || '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge className={statusColors[client.status || 'prospek']}>
                                                            {client.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {renewalStatus ? (
                                                            <Badge className={renewalStatus.color} variant="default">
                                                                <Calendar className='w-3 h-3 mr-1'/>
                                                                {renewalStatus.text}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary">N/A</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1"> {/* Kurangi gap jika perlu */}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => openHistoryDialog(client)}
                                                                title="Riwayat Komunikasi"
                                                                className="h-8 w-8" // Ukuran konsisten
                                                            >
                                                                <MessageCircle className="h-4 w-4 text-blue-500" />
                                                            </Button>

                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(client)}
                                                                title="Edit Klien"
                                                                className="h-8 w-8"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            {/* Tombol Hapus sekarang memicu AlertDialog */}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => confirmDelete(client)} // Panggil confirmDelete
                                                                title="Hapus Klien"
                                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                disabled={deleteMutation.isPending && clientToDelete?.id === client.id} // Disable saat menghapus client ini
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Tidak ada klien ditemukan. Tambahkan klien pertama Anda.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* COMMUNICATION HISTORY DIALOG (Modal) */}
                <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => {
                    setIsHistoryDialogOpen(open);
                    if (!open) setSelectedClientForHistory(null);
                }}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Riwayat Komunikasi</DialogTitle>
                            <DialogDescription>
                                {selectedClientForHistory?.nama} ({selectedClientForHistory?.bisnis})
                            </DialogDescription>
                        </DialogHeader>

                        <Separator className="my-2" />

                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Input Komunikasi Baru */}
                            <div className="md:col-span-1 space-y-4">
                                <CardHeader className="p-0">
                                    <CardTitle className="text-lg">Tambah Catatan</CardTitle>
                                    <CardDescription>Catat interaksi dan rencana follow up.</CardDescription>
                                </CardHeader>
                                <form onSubmit={handleAddCommunication} className="space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="comms-subject">Subjek</Label>
                                        <Input
                                            id="comms-subject"
                                            value={newCommunication.subject || ''}
                                            onChange={(e) => setNewCommunication({...newCommunication, subject: e.target.value})}
                                            placeholder="Diskusi Harga / Follow Up DP"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="comms-notes">Catatan Komunikasi *</Label>
                                        <Textarea
                                            id="comms-notes"
                                            value={newCommunication.notes || ''}
                                            onChange={(e) => setNewCommunication({...newCommunication, notes: e.target.value})}
                                            rows={4}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="comms-followup">Rencana Tindak Lanjut</Label>
                                        <Input
                                            id="comms-followup"
                                            type="date"
                                            value={newCommunication.follow_up_date || ''}
                                            onChange={(e) => setNewCommunication({...newCommunication, follow_up_date: e.target.value})}
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={createCommunicationMutation.isPending || !newCommunication.notes}
                                    >
                                        <MessageCircle className="h-4 w-4 mr-2" /> Simpan Catatan
                                    </Button>
                                </form>
                            </div>

                            {/* Riwayat Komunikasi */}
                            <div className="md:col-span-2 space-y-4">
                                <CardHeader className="p-0">
                                    <CardTitle className="text-lg">Riwayat ({communications.length})</CardTitle>
                                </CardHeader>
                                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                                    {isLoadingCommunications ? (
                                        <p className="text-muted-foreground">Memuat riwayat...</p>
                                    ) : communications.length === 0 ? (
                                        <p className="text-muted-foreground">Belum ada riwayat komunikasi.</p>
                                    ) : (
                                        communications.map(comms => (
                                            <div key={comms.id} className="border p-3 rounded-lg bg-secondary/30 space-y-1">
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span className="font-semibold text-foreground">{comms.subject || 'Catatan Umum'}</span>
                                                    <span className="text-right">{new Date(comms.created_at).toLocaleDateString('id-ID')}</span>
                                                </div>
                                                <p className="text-sm">{comms.notes}</p>
                                                {comms.follow_up_date && (
                                                    <div className="flex items-center text-xs text-orange-600 pt-1">
                                                        <Calendar className="h-3 w-3 mr-1" />
                                                        Tindak Lanjut: {new Date(comms.follow_up_date).toLocaleDateString('id-ID')}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>Tutup</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* AlertDialog untuk Konfirmasi Hapus Klien */}
                 <AlertDialog open={!!clientToDelete} onOpenChange={() => setClientToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Klien?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Anda yakin ingin menghapus klien "{clientToDelete?.nama}"? Riwayat komunikasi dan leads terkait juga akan terpengaruh. Tindakan ini tidak dapat dibatalkan. Pastikan tidak ada Proyek atau Invoice yang masih terhubung.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeDelete}
                            disabled={deleteMutation.isPending}
                            className={buttonVariants({ variant: "destructive" })} // Style tombol Hapus
                        >
                            {deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus Klien'}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>


            </div>
        </DashboardLayout>
    );
}