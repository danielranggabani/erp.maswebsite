// src/pages/Projects.tsx

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
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from '@/components/ui/dialog';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    PlusCircle,
    Search,
    Pencil,
    Trash2,
    CheckCircle2,
    ListChecks,
    Plus,
    Save,
    Archive,
    ArchiveRestore,
    AlertTriangle
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database, ProjectChecklistInsert as SupabaseProjectChecklistInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';
import { useRoles } from '@/hooks/useRoles';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { differenceInDays, parseISO, isValid, format } from 'date-fns';
import { sendWhatsappNotification } from '@/services/fonnte-service'; // IMPORT Fonnte Service

// --- Tipe Data ---
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
type UserRole = Database['public']['Enums']['user_role'];
type Client = Database['public']['Tables']['clients']['Row'];
type Package = Database['public']['Tables']['packages']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type ProjectChecklist = Database['public']['Tables']['project_checklists']['Row'];
type ProjectChecklistInsert = SupabaseProjectChecklistInsert;
type DeveloperPaymentTrackingInsert = Database['public']['Tables']['developer_payments_tracking']['Insert'];

interface ProjectExtended extends ProjectRow {
    clients: { nama: string } | null;
    packages: { nama: string } | null;
    progress: number | null;
    is_archived: boolean;
    profiles: { full_name: string, phone: string | null } | null; // Tambahkan profile untuk WA
}

// --- Konstanta & Helper ---
const statusColors = {
    briefing: 'bg-gray-500', desain: 'bg-blue-500', development: 'bg-yellow-500',
    revisi: 'bg-orange-500', launch: 'bg-green-500', selesai: 'bg-emerald-600',
};
const ARCHIVE_THRESHOLD_DAYS = 30;
const initialFormData: Partial<ProjectInsert> = {
    nama_proyek: '', client_id: '', package_id: null, harga: 0, ruang_lingkup: '',
    status: 'briefing', developer_id: null, tanggal_mulai: null, tanggal_selesai: null,
    estimasi_hari: null, fee_developer: 0, progress: 0, is_archived: false,
};
const formatCurrency = (amount: number | null | undefined): string => {
    if (amount == null || isNaN(Number(amount))) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(amount));
};

// ======================= HOOKS DATA & MUTASI =======================
const useProjectData = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: allData, isLoading, error, refetch } = useQuery({
        queryKey: ['projects-page-data'],
        queryFn: async () => {
             try {
                // Fetch Developers & Profiles data
                const { data: roleData, error: roleError } = await supabase.from('user_roles').select('user_id').eq('role', 'developer');
                if (roleError) throw new Error(`Fetch Roles Error: ${roleError.message}`);
                const developerIds = roleData.map(r => r.user_id);
                let devsData: Profile[] = [];
                if (developerIds.length > 0) {
                    const { data, error: devsError } = await supabase.from('profiles').select('id, full_name, phone').in('id', developerIds); 
                    if (devsError) throw new Error(`Fetch Profiles Error: ${devsError.message}`);
                    devsData = (data ?? []) as Profile[];
                }

                // Fetch Project Data (termasuk join profiles untuk WA)
                const [projectsRes, clientsRes, packagesRes] = await Promise.all([ 
                    supabase.from('projects').select(`
                        *, is_archived, clients(nama), packages(nama),
                        profiles(full_name, phone)
                    `).order('created_at', { ascending: false }), 
                    supabase.from('clients').select('id, nama'), 
                    supabase.from('packages').select('id, nama').eq('is_active', true), 
                ]);

                // [FIX] Error check untuk relasi yang hilang di Supabase schema
                if (projectsRes.error && projectsRes.error.message.includes('Could not find a relationship between')) {
                    console.warn(`[WARNING] Supabase Relational Error during project fetch: ${projectsRes.error.message}`);
                    const { data: simpleProjectsData, error: simpleProjectsError } = await supabase.from('projects').select('*, is_archived, clients(nama), packages(nama)').order('created_at', { ascending: false });
                    if (simpleProjectsError) throw new Error(`Fetch Projects Error (fallback): ${simpleProjectsError.message}`);
                    
                     const projectsData = (simpleProjectsData || []).map(p => ({ 
                        ...p, 
                        harga: Number(p.harga), 
                        fee_developer: p.fee_developer ? Number(p.fee_developer) : null, 
                        is_archived: p.is_archived ?? false,
                        profiles: null // Set profiles ke null jika join gagal
                    })) as ProjectExtended[];

                    return { 
                        projects: projectsData, 
                        clients: (clientsRes.data || []) as Client[], 
                        packages: (packagesRes.data || []) as Package[], 
                        developers: devsData, 
                    };
                }
                
                if (projectsRes.error) throw new Error(`Fetch Projects Error: ${projectsRes.error.message}`);
                if (clientsRes.error) throw new Error(`Fetch Clients Error: ${clientsRes.error.message}`);
                if (packagesRes.error) throw new Error(`Fetch Packages Error: ${packagesRes.error.message}`);

                const projectsData = (projectsRes.data || []).map(p => ({ 
                    ...p, 
                    harga: Number(p.harga), 
                    fee_developer: p.fee_developer ? Number(p.fee_developer) : null, 
                    is_archived: p.is_archived ?? false 
                })) as ProjectExtended[];
                
                return { 
                    projects: projectsData, 
                    clients: (clientsRes.data || []) as Client[], 
                    packages: (packagesRes.data || []) as Package[], 
                    developers: devsData, 
                };

            } catch (err: any) { 
                console.error("[useProjectData] Fetch Error:", err); 
                toast({ title: 'Gagal Memuat Data Proyek', description: err.message || 'Error tidak diketahui.', variant: 'destructive', duration: 7000 }); 
                throw err; 
            }
        },
        retry: 1,
    });
    
    // --- MODIFIKASI: createMutation (Project Ditugaskan) ---
    const createMutation = useMutation({
        mutationFn: async (data: ProjectInsert) => {
            if (!data.nama_proyek || !data.client_id) { throw new Error("Nama Proyek dan Klien wajib diisi."); }
            
            const { created_by, ...restData } = data;
            // Select data yang penting untuk notifikasi
            const { data: insertedData, error } = await supabase.from('projects').insert([restData]).select('id, nama_proyek, tanggal_selesai, client_id, developer_id').single();
            
            if (error) { throw error; }

            // Logika Notifikasi Project Ditugaskan
            if (insertedData.developer_id && insertedData.client_id) {
                const [devProfileRes, clientRes] = await Promise.all([
                    supabase.from('profiles').select('full_name, phone').eq('id', insertedData.developer_id).single(),
                    supabase.from('clients').select('nama').eq('id', insertedData.client_id).single()
                ]);

                const dev = devProfileRes.data;
                const clientName = clientRes.data?.nama || 'Klien Tidak Diketahui';
                const projectName = insertedData.nama_proyek || 'Proyek Baru';
                const deadline = insertedData.tanggal_selesai ? format(parseISO(insertedData.tanggal_selesai), 'dd MMMM yyyy') : 'Belum Ditentukan';
                
                if (dev?.phone) {
                    const message = `👨‍💻 Kamu mendapat tugas baru: *${projectName}* dari *${clientName}*. Deadline: *${deadline}*. Silakan cek di dashboard developer kamu.`;
                    const result = await sendWhatsappNotification({ target: dev.phone, message });
                    
                    if (!result.success) {
                         toast({ title: "Peringatan WA", description: `Notifikasi penugasan ke ${dev.full_name} gagal: ${result.message}`, variant: "warning" });
                    }
                }
            }
            return insertedData;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects-page-data'] }); toast({ title: 'Sukses', description: 'Proyek baru berhasil dibuat.' }); },
        onError: (error: any) => { toast({ title: 'Error Membuat Proyek', description: error.message, variant: 'destructive' }); },
    });
    
    // --- MODIFIKASI: updateMutation (Project Reassigned/Updated) ---
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectUpdate> }) => {
            const oldProject = allData?.projects.find(p => p.id === id); // Ambil data lama
            
            const { created_by, ...restData } = data;
            // Select data penting untuk notifikasi dan bandingkan developer_id lama dan baru
            const { data: updatedData, error } = await supabase
                .from('projects')
                .update(restData)
                .eq('id', id)
                .select('id, nama_proyek, tanggal_selesai, client_id, developer_id')
                .single();
            
            if (error) { throw error; }

            // Logika: Notifikasi hanya jika developer_id BERUBAH atau BARU ditambahkan
            if (updatedData.developer_id && updatedData.developer_id !== oldProject?.developer_id) {
                 const [devProfileRes, clientRes] = await Promise.all([
                    supabase.from('profiles').select('full_name, phone').eq('id', updatedData.developer_id).single(),
                    supabase.from('clients').select('nama').eq('id', updatedData.client_id).single()
                ]);

                const dev = devProfileRes.data;
                const clientName = clientRes.data?.nama || 'Klien Tidak Diketahui';
                const projectName = updatedData.nama_proyek || 'Proyek Baru';
                const deadline = updatedData.tanggal_selesai ? format(parseISO(updatedData.tanggal_selesai), 'dd MMMM yyyy') : 'Belum Ditentukan';

                if (dev?.phone) {
                    const message = `👨‍💻 Kamu mendapat tugas baru: *${projectName}* dari *${clientName}*. Deadline: *${deadline}*. Silakan cek di dashboard developer kamu.`;
                    const result = await sendWhatsappNotification({ target: dev.phone, message });
                    
                    if (!result.success) {
                         toast({ title: "Peringatan WA", description: `Notifikasi penugasan ke ${dev.full_name} gagal: ${result.message}`, variant: "warning" });
                    }
                }
            }
            return updatedData;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['projects-page-data'] });
            if ('is_archived' in variables.data) { toast({ title: 'Sukses', description: `Proyek ${variables.data.is_archived ? 'diarsipkan' : 'diaktifkan'}.` }); }
            else { toast({ title: 'Sukses', description: 'Proyek berhasil diperbarui.' }); }
        },
        onError: (error: any) => { toast({ title: 'Error Update Proyek', description: error.message, variant: 'destructive' }); },
    });
    
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error: checklistError } = await supabase.from('project_checklists').delete().eq('project_id', id);
            if (checklistError) console.warn("[Mutation] deleteMutation - Could not delete checklists:", checklistError.message);
            const { error } = await supabase.from('projects').delete().eq('id', id);
            if (error) { throw error; }
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects-page-data'] }); toast({ title: 'Proyek berhasil dihapus' }); },
        onError: (error: any) => { toast({ title: 'Error Hapus Proyek', description: `Gagal menghapus: ${error.message}. Pastikan tidak ada Invoice/SPK terkait.`, variant: 'destructive' }); }
    });
    
    return { projects: allData?.projects ?? [], clients: allData?.clients ?? [], packages: allData?.packages ?? [], developers: allData?.developers ?? [], isLoading, isError: !!error, error, createMutation, updateMutation, deleteMutation, refetchData: refetch };
};

const useChecklistData = (projectId: string | null) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: checklists, isLoading: isLoadingChecklists } = useQuery({
        queryKey: ['project-checklists', projectId],
        queryFn: async () => {
             if (!projectId) return [];
            const { data, error } = await supabase.from('project_checklists').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
            if (error) throw error;
            return data as ProjectChecklist[];
        },
        enabled: !!projectId,
    });

    const updateProjectProgress = async (currentProjectId: string | null, updatedChecklists: ProjectChecklist[]) => {
        if (!currentProjectId) return;
        let newProgress = 0;
        if (updatedChecklists && updatedChecklists.length > 0) {
            const doneCount = updatedChecklists.filter(item => item.is_done).length;
            newProgress = Math.round((doneCount / updatedChecklists.length) * 100);
        }

        const { error } = await supabase.from('projects').update({ progress: newProgress }).eq('id', currentProjectId);
        if (error) {
            console.error("Failed to update project progress:", error);
            toast({ title: 'Error', description: 'Gagal update progress proyek.', variant: 'destructive' });
        } else {
             queryClient.invalidateQueries({ queryKey: ['projects-page-data'] });
        }
    };

    const invalidateChecklistAndProject = async (currentProjectId: string | null) => {
        await queryClient.invalidateQueries({ queryKey: ['project-checklists', currentProjectId] });
        const freshChecklists = await queryClient.fetchQuery<ProjectChecklist[]>({ queryKey: ['project-checklists', currentProjectId] });
        if (freshChecklists) {
            await updateProjectProgress(currentProjectId, freshChecklists);
        }
    };

    const addChecklistMutation = useMutation({
        mutationFn: async (newItem: ProjectChecklistInsert) => {
            const { error } = await supabase.from('project_checklists').insert({...newItem, updated_by: user?.id});
            if (error) throw error;
        },
        onSuccess: (_, variables) => { invalidateChecklistAndProject(variables.project_id); toast({ title: 'Checklist item ditambahkan.' }); },
        onError: (error: any) => toast({ title: 'Error', description: `Gagal menambah item: ${error.message}`, variant: 'destructive' })
    });

    const updateChecklistMutation = useMutation({
        mutationFn: async ({ id, is_done, currentProjectId }: { id: string, is_done: boolean, currentProjectId: string | null }) => {
            const { error } = await supabase.from('project_checklists').update({ is_done, updated_by: user?.id }).eq('id', id);
            if (error) throw error;
            return { currentProjectId };
        },
        onSuccess: (data) => { invalidateChecklistAndProject(data.currentProjectId); },
        onError: (error: any) => toast({ title: 'Error', description: `Gagal update item: ${error.message}`, variant: 'destructive' })
    });

    const deleteChecklistMutation = useMutation({
        mutationFn: async ({ id, currentProjectId }: { id: string, currentProjectId: string | null }) => {
            const { error } = await supabase.from('project_checklists').delete().eq('id', id);
            if (error) throw error;
            return { currentProjectId };
        },
        onSuccess: (data) => { invalidateChecklistAndProject(data.currentProjectId); toast({ title: 'Checklist item dihapus.' }); },
        onError: (error: any) => toast({ title: 'Error', description: `Gagal menghapus item: ${error.message}`, variant: 'destructive' })
    });

    return { checklists: checklists ?? [], isLoadingChecklists, addChecklistMutation, updateChecklistMutation, deleteChecklistMutation };
};

// --- Komponen ChecklistDialog ---
interface ChecklistDialogProps { project: ProjectExtended | null; isOpen: boolean; onOpenChange: (open: boolean) => void; canManage: boolean; }
const ChecklistDialog: React.FC<ChecklistDialogProps> = ({ project, isOpen, onOpenChange, canManage }) => {
     const { toast } = useToast();
     const [newItemTitle, setNewItemTitle] = useState('');
     const { checklists, isLoadingChecklists, addChecklistMutation, updateChecklistMutation, deleteChecklistMutation } = useChecklistData(project?.id ?? null);

     const calculateProgress = (items: ProjectChecklist[]): number => {
       if (!items || items.length === 0) return project?.progress ?? 0;
       const doneCount = items.filter(item => item.is_done).length;
       return Math.round((doneCount / items.length) * 100);
     };
     const currentProgress = calculateProgress(checklists);

     const handleAddItem = (e: React.FormEvent) => {
         e.preventDefault();
         if (!newItemTitle.trim() || !project?.id) return;
         addChecklistMutation.mutate({ project_id: project.id, title: newItemTitle.trim(), is_done: false }, { onSuccess: () => setNewItemTitle('') });
     };

     const handleToggleDone = (item: ProjectChecklist) => {
         updateChecklistMutation.mutate({ id: item.id, is_done: !item.is_done, currentProjectId: project?.id ?? null });
     };

     const handleDeleteItem = (id: string) => {
         if (confirm('Hapus item checklist ini?')) { // Tetap pakai confirm untuk checklist item
             deleteChecklistMutation.mutate({ id, currentProjectId: project?.id ?? null });
         }
     };

     return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
             <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
                 <DialogHeader>
                     <DialogTitle>Checklist Proyek: {project?.nama_proyek}</DialogTitle>
                     <DialogDescription>Kelola daftar tugas. Progress: {currentProgress}%</DialogDescription>
                     <Progress value={currentProgress} className="w-full h-2 mt-2" />
                 </DialogHeader>
                 <div className="flex-1 overflow-y-auto pr-2 space-y-3 py-4">
                     {isLoadingChecklists ? ( <p className="text-muted-foreground text-center">Memuat...</p> )
                     : checklists.length === 0 && !canManage ? ( <p className="text-muted-foreground text-center">Belum ada checklist.</p> )
                     : (checklists.map((item) => ( <div key={item.id} className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50">
                         <Checkbox id={`check-${item.id}`} checked={item.is_done} onCheckedChange={() => handleToggleDone(item)} disabled={!canManage || updateChecklistMutation.isPending} />
                         <label htmlFor={`check-${item.id}`} className={`flex-1 text-sm ${item.is_done ? 'line-through text-muted-foreground' : ''} ${canManage ? 'cursor-pointer' : 'cursor-default'}`}>{item.title}</label>
                         {canManage && ( <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteItem(item.id)} disabled={deleteChecklistMutation.isPending} title="Hapus"><Trash2 className="h-3 w-3 text-destructive" /></Button> )}
                        </div> )))}
                     {checklists.length === 0 && canManage && ( <p className="text-muted-foreground text-center">Belum ada checklist. Tambahkan di bawah.</p> )}
                   </div>
                   {canManage && ( <form onSubmit={handleAddItem} className="flex gap-2 pt-4 border-t">
                       <Input placeholder="Item baru..." value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} required disabled={addChecklistMutation.isPending} />
                       <Button type="submit" size="icon" disabled={addChecklistMutation.isPending || !newItemTitle.trim()}> <Plus className="h-4 w-4" /> </Button>
                   </form> )}
                   <DialogFooter> <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button> </DialogFooter>
                </DialogContent>
          </Dialog>
      );
};


// ======================= KOMPONEN UTAMA PROJECTS =======================
export default function Projects() {
    const { toast } = useToast();
    const { user } = useAuth();
    const { roles, isLoading: rolesLoading } = useRoles();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<ProjectInsert>>(initialFormData);
    const [editingProject, setEditingProject] = useState<ProjectExtended | null>(null);
    const [isChecklistDialogOpen, setIsChecklistDialogOpen] = useState(false);
    const [selectedProjectForChecklist, setSelectedProjectForChecklist] = useState<ProjectExtended | null>(null);
    const [activeTab, setActiveTab] = useState<'aktif' | 'arsip'>('aktif');

    // State untuk AlertDialogs
    const [projectToMarkDone, setProjectToMarkDone] = useState<ProjectExtended | null>(null);
    const [projectToArchiveToggle, setProjectToArchiveToggle] = useState<ProjectExtended | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<ProjectExtended | null>(null);


    const isAdmin = roles.includes('admin');
    const isCS = roles.includes('cs');
    const isDeveloper = roles.includes('developer');
    const isFullAccessRole = isAdmin || isCS;

    useEffect(() => {
        if (user) setCurrentUserId(user.id);
     }, [user]);

    const { projects, clients, packages, developers, isLoading, isError, error: dataError, createMutation, updateMutation, deleteMutation, refetchData } = useProjectData();
    const queryClient = useQueryClient();

    const developerMap = new Map(developers.map(dev => [dev.id, dev.full_name]));
    const clientOptions = clients;
    const developerOptions = developers;

    const markAsDoneMutation = useMutation({
        mutationFn: async ({ projectId, feeDeveloper, developerId }: { projectId: string; feeDeveloper: number | null; developerId: string | null }) => {
            const { error: updateError } = await supabase.from('projects').update({ status: 'selesai', tanggal_selesai: new Date().toISOString().split('T')[0] }).eq('id', projectId);
            if (updateError) throw updateError;
            if (feeDeveloper && feeDeveloper > 0 && developerId) {
                const paymentData: DeveloperPaymentTrackingInsert = { project_id: projectId, developer_id: developerId, amount_paid: feeDeveloper, paid_at: new Date().toISOString(), notes: `Fee otomatis dari penyelesaian proyek ID: ${projectId.substring(0, 8)}...` };
                const { error: insertError } = await supabase.from('developer_payments_tracking').insert(paymentData);
                if (insertError) throw new Error(`Gagal mencatat fee developer: ${insertError.message}. Status proyek sudah diupdate.`);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects-page-data'] });
            queryClient.invalidateQueries({ queryKey: ['developer-stats'] });
            queryClient.invalidateQueries({ queryKey: ['developer-stats-dashboard'] });
            toast({ title: 'Sukses', description: 'Proyek ditandai selesai dan fee developer dicatat (jika ada).' });
        },
        onError: (error: any) => {
            const message = error.message.startsWith('Gagal mencatat fee') ? error.message : `Gagal menandai selesai: ${error.message}.`;
            toast({ title: 'Error', description: message, variant: 'destructive' });
        },
    });


    // --- HANDLERS DENGAN AlertDialog ---
    const confirmMarkAsDone = (project: ProjectExtended) => {
        if (!isAdmin && !isCS && project.developer_id !== currentUserId) {
            return toast({ title: 'Akses Ditolak', description: 'Hanya developer yang ditugaskan atau Admin/CS.', variant: 'destructive'});
        }
        setProjectToMarkDone(project);
    };
    const executeMarkAsDone = () => {
        if (!projectToMarkDone) return;
        const fee = projectToMarkDone.fee_developer ? Number(projectToMarkDone.fee_developer) : null;
        const devId = projectToMarkDone.developer_id;
        markAsDoneMutation.mutate({ projectId: projectToMarkDone.id, feeDeveloper: fee, developerId: devId },
           { onSettled: () => setProjectToMarkDone(null) }
        );
    };

    const confirmArchiveToggle = (project: ProjectExtended) => {
        if (!isFullAccessRole) return toast({ title: 'Akses Ditolak', variant: 'destructive' });
        setProjectToArchiveToggle(project);
    };
    const executeArchiveToggle = () => {
        if (!projectToArchiveToggle) return;
        const newArchivedStatus = !projectToArchiveToggle.is_archived;
        updateMutation.mutate({ id: projectToArchiveToggle.id, data: { is_archived: newArchivedStatus } },
          { onSettled: () => setProjectToArchiveToggle(null) }
        );
    };

    const confirmDelete = (project: ProjectExtended) => {
        if (!isFullAccessRole) return toast({ title: "Akses Ditolak", variant: "destructive"});
        setProjectToDelete(project);
    };
    const executeDelete = () => {
        if (!projectToDelete) return;
        deleteMutation.mutate(projectToDelete.id,
          { onSettled: () => setProjectToDelete(null) }
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFullAccessRole) return toast({ title: "Akses Ditolak", variant: "destructive"});
        const currentFormData = { ...formData };
        const namaProyekTrimmed = currentFormData.nama_proyek?.trim();
        const clientIdSelected = currentFormData.client_id;
        if (!namaProyekTrimmed || !clientIdSelected) return toast({ title: "Input Tidak Lengkap", description: "Nama Proyek dan Klien wajib diisi.", variant: "destructive"});

        const dataToSave: Partial<ProjectInsert> = {
            nama_proyek: namaProyekTrimmed, client_id: clientIdSelected, package_id: currentFormData.package_id || null,
            harga: Number(currentFormData.harga) || 0, ruang_lingkup: currentFormData.ruang_lingkup?.trim() || null,
            status: currentFormData.status || 'briefing', developer_id: currentFormData.developer_id || null,
            tanggal_mulai: currentFormData.tanggal_mulai || null, tanggal_selesai: currentFormData.tanggal_selesai || null,
            estimasi_hari: Number(currentFormData.estimasi_hari) || null, fee_developer: Number(currentFormData.fee_developer) || 0,
        };
        const originalStatus = editingProject?.status;
        try {
            if (editingProject?.id) {
                updateMutation.mutate({ id: editingProject.id, data: dataToSave }, {
                    onSuccess: (updatedData) => {
                        setIsProjectDialogOpen(false);
                        // Log aktivitas (opsional, karena created_by tidak ada)
                        if (updatedData && updatedData.status !== originalStatus && currentUserId) {
                            console.log(`[Activity Log] Status proyek '${updatedData.nama_proyek}' diubah dari ${originalStatus} ke ${updatedData.status}`);
                        }
                    }
                });
            } else {
                const { id, ...insertData } = dataToSave; // Hapus ID jika ada (seharusnya tidak ada)
                createMutation.mutate(insertData as ProjectInsert, { onSuccess: () => setIsProjectDialogOpen(false) });
            }
        } catch (err: any) { toast({ title: 'Error Simpan', description: `Gagal menyimpan: ${err.message}`, variant: 'destructive' }); }
    };

    const handleEdit = (project: ProjectExtended) => {
        setEditingProject(project);
        setFormData({
            nama_proyek: project.nama_proyek, client_id: project.client_id, package_id: project.package_id,
            harga: Number(project.harga), ruang_lingkup: project.ruang_lingkup, status: project.status, developer_id: project.developer_id,
            tanggal_mulai: project.tanggal_mulai, tanggal_selesai: project.tanggal_selesai, estimasi_hari: project.estimasi_hari,
            fee_developer: project.fee_developer ? Number(project.fee_developer) : 0,
        });
        setIsProjectDialogOpen(true);
    };

    const openChecklistDialog = (project: ProjectExtended) => { setSelectedProjectForChecklist(project); setIsChecklistDialogOpen(true); };
    const canManageChecklist = (project: ProjectExtended | null): boolean => !!project && (isFullAccessRole || (isDeveloper && project.developer_id === currentUserId));
    const filteredProjects = projects.filter(p => {
        const searchLower = search.toLowerCase();
        const searchMatches = (p.nama_proyek || '').toLowerCase().includes(searchLower) || (p.clients?.nama || '').toLowerCase().includes(searchLower) || (developerMap.get(p.developer_id)?.toLowerCase() || '').includes(searchLower);
        if (!searchMatches) return false;
        const isCompleted = p.status === 'selesai';
        let isOlderThanThreshold = false;
        if (isCompleted && p.tanggal_selesai) { try { const d = parseISO(p.tanggal_selesai); if (isValid(d)) isOlderThanThreshold = differenceInDays(new Date(), d) > ARCHIVE_THRESHOLD_DAYS; } catch (e) {} }
        const isManuallyArchived = p.is_archived === true;
        const shouldBeInArchive = isManuallyArchived || (isCompleted && isOlderThanThreshold);
        return activeTab === 'aktif' ? !shouldBeInArchive : shouldBeInArchive;
    });
    const getStatusBadge = (status: Project['status']) => {
        const statusKey = (status || 'briefing').toLowerCase() as keyof typeof statusColors;
        const displayStatus = (status?.replace('_', ' ') || 'Briefing');
        return <Badge className={`${statusColors[statusKey]} capitalize text-white hover:${statusColors[statusKey]}`}>{displayStatus}</Badge>;
    };

    if (rolesLoading) return <DashboardLayout><div className="flex min-h-screen items-center justify-center"><p>Memuat...</p></div></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                {/* Header & Tombol Tambah Proyek */}
                <div className="flex items-center justify-between">
                    <div> <h2 className="text-3xl font-bold tracking-tight">Manajemen Proyek</h2> <p className="text-muted-foreground">Kelola semua proyek dan progres pengerjaan.</p> </div>
                    {isFullAccessRole && (
                        <Dialog open={isProjectDialogOpen} onOpenChange={(open) => { setIsProjectDialogOpen(open); if (!open) { setEditingProject(null); setFormData(initialFormData); } }}>
                            <DialogTrigger asChild>
                                <Button onClick={() => { setFormData(initialFormData); }}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Tambah Proyek Baru
                                </Button>
                            </DialogTrigger>
                             <DialogContent className="max-w-3xl">
                                 <DialogHeader> <DialogTitle>{editingProject ? 'Edit Proyek' : 'Tambah Proyek Baru'}</DialogTitle> <DialogDescription>Input detail proyek.</DialogDescription> </DialogHeader>
                                 <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto pr-4">
                                     <div className="grid gap-4 py-4">
                                         {/* Form Fields Tetap Sama */}
                                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                             <div className="space-y-2"> <Label htmlFor="nama_proyek">Nama Proyek *</Label> <Input id="nama_proyek" required value={formData.nama_proyek || ''} onChange={(e) => setFormData({ ...formData, nama_proyek: e.target.value })} /> </div>
                                             <div className="space-y-2"> <Label htmlFor="client_id">Klien *</Label> <Select value={formData.client_id || undefined} onValueChange={(value) => setFormData({ ...formData, client_id: value })} required> <SelectTrigger><SelectValue placeholder="Pilih Klien" /></SelectTrigger> <SelectContent> {clientOptions?.map(c => ( <SelectItem key={c.id} value={c.id}>{c.nama}</SelectItem> ))} </SelectContent> </Select> </div>
                                             <div className="space-y-2"> <Label htmlFor="harga">Harga Proyek (Rp)</Label> <Input id="harga" type="number" value={formData.harga || 0} onChange={(e) => setFormData({ ...formData, harga: Number(e.target.value) })} /> </div>
                                         </div>
                                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                             <div className="space-y-2"> <Label htmlFor="status">Status *</Label> <Select value={formData.status || 'briefing'} onValueChange={(value) => setFormData({ ...formData, status: value as any })}> <SelectTrigger><SelectValue /></SelectTrigger> <SelectContent> {['briefing', 'desain', 'development', 'revisi', 'launch', 'selesai'].map(s => ( <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem> ))} </SelectContent> </Select> </div>
                                             <div className="space-y-2"> <Label htmlFor="developer_id">Developer</Label> <Select value={formData.developer_id ?? undefined} onValueChange={(value) => setFormData({ ...formData, developer_id: value || null })} > <SelectTrigger> <SelectValue placeholder="Pilih Developer" /> </SelectTrigger> <SelectContent> {developerOptions?.map(d => ( <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem> ))} </SelectContent> </Select> </div>
                                             <div className="space-y-2"> <Label htmlFor="fee_developer">Fee Developer (Rp)</Label> <Input id="fee_developer" type="number" value={formData.fee_developer || 0} onChange={(e) => setFormData({ ...formData, fee_developer: Number(e.target.value) })} /> </div>
                                         </div>
                                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                             <div className="space-y-2"> <Label htmlFor="tanggal_mulai">Tanggal Mulai</Label> <Input id="tanggal_mulai" type="date" value={formData.tanggal_mulai || ''} onChange={(e) => setFormData({ ...formData, tanggal_mulai: e.target.value || null })}/> </div>
                                             <div className="space-y-2"> <Label htmlFor="estimasi_hari">Estimasi Hari</Label> <Input id="estimasi_hari" type="number" value={formData.estimasi_hari || ''} onChange={(e) => setFormData({ ...formData, estimasi_hari: Number(e.target.value) || null })} placeholder="Contoh: 14" /> </div>
                                             <div className="space-y-2"> <Label htmlFor="tanggal_selesai">Tanggal Selesai</Label> <Input id="tanggal_selesai" type="date" value={formData.tanggal_selesai || ''} onChange={(e) => setFormData({ ...formData, tanggal_selesai: e.target.value || null })}/> </div>
                                         </div>
                                         <div className="space-y-2"> <Label htmlFor="ruang_lingkup">Ruang Lingkup</Label> <Textarea id="ruang_lingkup" value={formData.ruang_lingkup || ''} onChange={(e) => setFormData({ ...formData, ruang_lingkup: e.target.value })} rows={3} /> </div>
                                     </div>
                                     <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t"> <Button type="button" variant="outline" onClick={() => setIsProjectDialogOpen(false)}>Batal</Button> <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}> <Save className="h-4 w-4 mr-2" /> {editingProject ? 'Simpan' : 'Buat'} </Button> </DialogFooter>
                                 </form>
                             </DialogContent>
                        </Dialog>
                    )}
                </div>

                {isError && (
                    <div className="p-4 mb-4 bg-destructive/10 text-destructive border border-destructive rounded-md">
                        Gagal memuat data proyek: {dataError?.message || 'Error tidak diketahui'}. Coba refresh.
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'aktif' | 'arsip')}>
                    {/* Tab Header & Search */}
                    <div className="flex justify-between items-center mb-4"> <TabsList> <TabsTrigger value="aktif">Proyek Aktif</TabsTrigger> <TabsTrigger value="arsip">Arsip Proyek</TabsTrigger> </TabsList> <div className="relative w-full max-w-sm"> <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /> <Input placeholder="Cari proyek, klien, dev..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /> </div> </div>

                    <TabsContent value="aktif">
                        <Card>
                            <CardHeader><CardTitle>Proyek Aktif ({filteredProjects.length})</CardTitle></CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="min-w-[200px]">Proyek</TableHead><TableHead>Klien</TableHead><TableHead>Developer</TableHead><TableHead className="min-w-[120px]">Progress</TableHead><TableHead>Status</TableHead><TableHead className="text-right min-w-[200px]">Aksi</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {isLoading ? ( <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow> )
                                            : isError ? ( <TableRow><TableCell colSpan={6} className="text-center py-8 text-destructive">Gagal memuat data.</TableCell></TableRow> )
                                            : projects.length === 0 && activeTab === 'aktif' ? ( <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada proyek.</TableCell></TableRow> )
                                            : filteredProjects.length === 0 ? ( <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Tidak ada proyek aktif yang cocok.</TableCell></TableRow> )
                                            : ( filteredProjects.map(project => {
                                                     const isAssignedToCurrentUser = isDeveloper && project.developer_id === currentUserId;
                                                     const canManage = isFullAccessRole || isAssignedToCurrentUser;
                                                     return (
                                                         <TableRow key={project.id}>
                                                             <TableCell className="font-medium">{project.nama_proyek}</TableCell>
                                                             <TableCell>{project.clients?.nama || '-'}</TableCell>
                                                             <TableCell>{developerMap.get(project.developer_id) || '-'}</TableCell>
                                                             <TableCell><div className="flex items-center gap-2"><Progress value={project.progress ?? 0} className="w-20 h-2" /><span className="text-xs text-muted-foreground">{project.progress ?? 0}%</span></div></TableCell>
                                                             <TableCell>{getStatusBadge(project.status)}</TableCell>
                                                             <TableCell className="text-right">
                                                                 <div className="flex justify-end gap-1">
                                                                     <Button size="icon" variant="ghost" title="Checklist" onClick={() => openChecklistDialog(project)} className="h-8 w-8"><ListChecks className="h-4 w-4" /></Button>
                                                                     {canManage && project.status !== 'selesai' && (
                                                                         <Button size="icon" variant="ghost" title="Tandai Selesai" onClick={() => confirmMarkAsDone(project)} disabled={markAsDoneMutation.isPending && projectToMarkDone?.id === project.id} className="h-8 w-8 text-green-600 hover:bg-green-100"><CheckCircle2 className="h-4 w-4" /></Button>
                                                                     )}
                                                                     {isFullAccessRole && (<Button size="icon" variant="ghost" title="Arsipkan" onClick={() => confirmArchiveToggle(project)} disabled={updateMutation.isPending && projectToArchiveToggle?.id === project.id} className="h-8 w-8 text-gray-500 hover:bg-gray-100"><Archive className="h-4 w-4" /></Button>)}
                                                                     {isFullAccessRole && (<Button size="icon" variant="ghost" title="Edit" onClick={() => handleEdit(project)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>)}
                                                                     {isFullAccessRole && (<Button size="icon" variant="ghost" title="Hapus" onClick={() => confirmDelete(project)} disabled={deleteMutation.isPending && projectToDelete?.id === project.id} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>)}
                                                                 </div>
                                                             </TableCell>
                                                         </TableRow>
                                                     ); 
                                                }))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="arsip">
                         <Card>
                            <CardHeader>
                                <CardTitle>Arsip Proyek ({filteredProjects.length})</CardTitle>
                                <CardDescription>Selesai {'>'} {ARCHIVE_THRESHOLD_DAYS} hari atau diarsip manual.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="min-w-[200px]">Proyek</TableHead><TableHead>Klien</TableHead><TableHead>Tgl Selesai</TableHead><TableHead>Status Arsip</TableHead><TableHead className="text-right min-w-[150px]">Aksi</TableHead></TableRow></TableHeader>
                                         <TableBody>
                                             {isLoading ? ( <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow> )
                                             : isError ? ( <TableRow><TableCell colSpan={5} className="text-center py-8 text-destructive">Gagal memuat data.</TableCell></TableRow> )
                                             : projects.length === 0 && activeTab === 'arsip' ? ( <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Belum ada proyek.</TableCell></TableRow> )
                                             : filteredProjects.length === 0 ? ( <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada proyek di arsip.</TableCell></TableRow> )
                                             : ( filteredProjects.map(project => (
                                                     <TableRow key={project.id} className="opacity-70 hover:opacity-100">
                                                         <TableCell className="font-medium">{project.nama_proyek}</TableCell>
                                                         <TableCell>{project.clients?.nama || '-'}</TableCell>
                                                         <TableCell>{project.tanggal_selesai ? new Date(project.tanggal_selesai).toLocaleDateString('id-ID') : '-'}</TableCell>
                                                         <TableCell><Badge variant={project.is_archived ? "secondary" : "outline"}>{project.is_archived ? "Manual" : "Otomatis"}</Badge></TableCell>
                                                         <TableCell className="text-right">
                                                             <div className="flex justify-end gap-1">
                                                                 <Button size="icon" variant="ghost" title="Checklist" onClick={() => openChecklistDialog(project)} className="h-8 w-8"><ListChecks className="h-4 w-4" /></Button>
                                                                 {isFullAccessRole && (<Button size="icon" variant="ghost" title="Aktifkan Kembali" onClick={() => confirmArchiveToggle(project)} disabled={updateMutation.isPending && projectToArchiveToggle?.id === project.id} className="h-8 w-8 text-blue-600 hover:bg-blue-100"><ArchiveRestore className="h-4 w-4" /></Button>)}
                                                                 {isFullAccessRole && (<Button size="icon" variant="ghost" title="Hapus Permanen" onClick={() => confirmDelete(project)} disabled={deleteMutation.isPending && projectToDelete?.id === project.id} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>)}
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
                    </TabsContent>
                </Tabs>

                <ChecklistDialog project={selectedProjectForChecklist} isOpen={isChecklistDialogOpen} onOpenChange={setIsChecklistDialogOpen} canManage={canManageChecklist(selectedProjectForChecklist)} />

                {/* AlertDialogs */}
                <AlertDialog open={!!projectToMarkDone} onOpenChange={() => setProjectToMarkDone(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle><CheckCircle2 className="inline-block mr-2 h-5 w-5 text-green-600"/> Tandai Proyek Selesai?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tandai "{projectToMarkDone?.nama_proyek}" selesai?
                                {projectToMarkDone?.fee_developer && projectToMarkDone.developer_id ? ` Fee ${formatCurrency(Number(projectToMarkDone.fee_developer))} akan dicatat.` : ''}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={executeMarkAsDone} disabled={markAsDoneMutation.isPending} className={buttonVariants({ className: "bg-green-600 hover:bg-green-700" })}>
                                {markAsDoneMutation.isPending ? 'Memproses...' : 'Ya, Selesai'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={!!projectToArchiveToggle} onOpenChange={() => setProjectToArchiveToggle(null)}>
                     <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{projectToArchiveToggle?.is_archived ? <ArchiveRestore className="inline-block mr-2 h-5 w-5 text-blue-600"/> : <Archive className="inline-block mr-2 h-5 w-5 text-gray-600"/>} Konfirmasi Arsip</AlertDialogTitle>
                            <AlertDialogDescription>
                                Yakin {projectToArchiveToggle?.is_archived ? 'mengaktifkan kembali' : 'mengarsipkan'} proyek "{projectToArchiveToggle?.nama_proyek}"?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={executeArchiveToggle} disabled={updateMutation.isPending} className={buttonVariants({ variant: projectToArchiveToggle?.is_archived ? "default" : "secondary" })}>
                                {updateMutation.isPending ? 'Memproses...' : `Ya, ${projectToArchiveToggle?.is_archived ? 'Aktifkan' : 'Arsipkan'}`}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
                     <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle><AlertTriangle className="inline-block mr-2 h-5 w-5 text-destructive"/> Hapus Proyek?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Yakin hapus proyek "{projectToDelete?.nama_proyek}" permanen? Checklist terkait akan hilang.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={executeDelete} disabled={deleteMutation.isPending} className={buttonVariants({ variant: "destructive" })}>
                                {deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </DashboardLayout>
    );
}
