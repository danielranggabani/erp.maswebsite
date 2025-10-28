import { supabase } from '@/integrations/supabase/client'; // Import Supabase jika diperlukan
import { format } from 'date-fns';
// Asumsi formatCurrency sudah tersedia global atau di utilitas Anda
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

interface FonntePayload {
    target: string; // Nomor telepon developer (diawali 62)
    message: string;
}

/**
 * Mengirim pesan WhatsApp melalui Fonnte API.
 */
export async function sendWhatsappNotification(payload: FonntePayload): Promise<{ success: boolean; message: string }> {
    const url = import.meta.env.VITE_FONNTE_BASE_URL || "https://api.fonnte.com/send";
    const apiKey = import.meta.env.VITE_FONNTE_API_KEY;

    if (!apiKey) {
        console.error("KONFIGURASI FONNTE HILANG: VITE_FONNTE_API_KEY belum diatur.");
        return { success: false, message: "Konfigurasi API Fonnte tidak lengkap." };
    }
    
    const cleanTarget = payload.target.replace(/[^0-9]/g, '');
    if (!cleanTarget.startsWith('62')) {
         return { success: false, message: "Nomor target tidak valid (harus 62xxxx)." };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
            },
            body: JSON.stringify({
                target: cleanTarget,
                message: payload.message,
            }),
        });

        const data = await response.json();

        if (response.ok && (data.status === true || data.status === 'success')) {
            return { success: true, message: "Notifikasi WA berhasil dikirim." };
        } else {
            console.error("Fonnte API Error:", data);
            return { success: false, message: data.reason || data.message || "Gagal mengirim notifikasi via Fonnte." };
        }

    } catch (error) {
        console.error("Fetch Fonnte API Exception:", error);
        return { success: false, message: `Koneksi error: ${(error as Error).message}` };
    }
}


/**
 * Pemicu notifikasi setelah fee developer dicatat pembayarannya.
 */
export async function triggerFeePaidNotification(developerId: string, projectName: string, amount: number, toast: Function) {
    if (!developerId) return;

    const { data: dev, error: devError } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', developerId)
        .single();

    if (devError) {
        console.error("Gagal fetch profile untuk notifikasi fee:", devError);
        return;
    }

    if (dev?.phone && amount > 0) {
        const message = `💰 Fee proyek *${projectName}* sebesar *${formatCurrency(amount)}* telah ditransfer. Terima kasih atas kerja samanya!`;
        const result = await sendWhatsappNotification({ target: dev.phone, message });

        if (!result.success) {
            toast({ title: "Peringatan WA", description: `Notifikasi pembayaran fee ke ${dev.full_name} gagal: ${result.message}`, variant: "warning" });
        }
    }
}