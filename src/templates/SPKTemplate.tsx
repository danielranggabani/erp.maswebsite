// File: src/templates/SPKTemplate.tsx

import React from 'react';

// Fungsi bantuan untuk mengubah angka menjadi terbilang (FUNGSI INI DIHAPUS DARI PENGGUNAAN)
const terbilang = (num: number): string => {
    // Fungsi ini tetap didefinisikan agar tidak error, tapi tidak dipanggil.
    return 'Implementasi Terbilang Dihapus'; 
};

// Fungsi bantuan untuk format mata uang
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount).replace('Rp', '').trim();
};

// Definisi Props
export interface SPKTemplateProps {
    spkNumber: string;
    todayDate: string;
    totalPrice: number;
    
    // Data Agency
    companyName: string;
    companyAddress: string;
    companyAccount: string;
    companyEmail: string;
    companyTelp: string;
    logoUrl: string | null;
    signatureUrl: string | null;

    // Data Klien
    clientName: string;
    clientBusiness: string;
    clientAddress: string; 
    clientEmail: string; 
    clientTelp: string; 

    // Data Proyek
    projectName: string;
    scopeOfWork: string;
    websiteType: string;
}


export const SPKTemplate: React.FC<SPKTemplateProps> = ({
    spkNumber,
    todayDate,
    totalPrice,
    companyName,
    companyAddress,
    companyAccount,
    companyEmail,
    companyTelp,
    logoUrl,
    signatureUrl,
    clientName,
    clientBusiness,
    clientAddress,
    clientEmail,
    clientTelp,
    projectName,
    scopeOfWork,
    websiteType,
}) => {
    // Memisahkan Bank dan No. Rekening dari companyAccount
    let bankName = '-';
    let accountNumber = '-';
    let accountOwner = companyName; 

    if (companyAccount) {
        const match = companyAccount.match(/^(\S+)\s+(.+)/);
        if (match) {
            bankName = match[1];
            accountNumber = match[2].replace(/\(|\)/g, '').trim(); 
        } else {
             bankName = companyAccount.split(' ')[0];
             accountNumber = companyAccount.slice(bankName.length).trim().replace(/\(|\)/g, '').trim();
        }
        const numberMatch = accountNumber.match(/^(\d+[\d\s-]*)/);
        if (numberMatch) {
            accountNumber = numberMatch[1].trim();
        }
    }
    
    // Mendapatkan Kota dari Alamat Perusahaan
    const kota = companyAddress.split(',')[0].trim() || 'Jakarta'; 
    const tanggalTtd = todayDate; 

    return (
        // FIX WARNA: Latar belakang eksplisit putih
        <div className="spk-document p-8 font-sans text-gray-800 text-sm leading-relaxed" style={{ 
            minHeight: '1122px', 
            border: '1px solid #ccc',
            position: 'relative',
            backgroundColor: '#ffffff' // FIX: Memastikan latar belakang putih
        }}>
            
            {/* Kop Surat (Opsional) */}
            {logoUrl && <img src={logoUrl} alt="Logo" className="w-24 h-auto mb-4 mx-auto" />}

            <h1 className="text-xl font-bold text-center mb-6">SURAT PERINTAH KERJA (SPK)</h1>

            {/* Bagian Nomor dan Tanggal */}
            <p className="text-center mb-10">
                Nomor: <span className="font-bold">{spkNumber}</span><br />
                Tanggal: <span className="font-bold">{todayDate}</span>
            </p>

            {/* I. PIHAK YANG BERKONTRAK */}
            <h2 className="text-lg font-semibold mb-3">I. PIHAK YANG BERKONTRAK</h2>
            <div className="grid grid-cols-2 gap-4 mb-6 border p-4 rounded">
                <div>
                    <h3 className="font-bold mb-2">Pihak Pertama (Penyedia Jasa):</h3>
                    <p>Nama Perusahaan: {companyName}</p>
                    <p>Alamat: {companyAddress}</p>
                    <p>Email: {companyEmail}</p>
                    <p>No. Telp: {companyTelp}</p>
                </div>
                <div>
                    <h3 className="font-bold mb-2">Pihak Kedua (Klien):</h3>
                    <p>Nama Klien: {clientName}</p>
                    <p>Perusahaan / Usaha: {clientBusiness}</p>
                    <p>Alamat: {clientAddress}</p> 
                    <p>Email: {clientEmail}</p>
                    <p>No. Telp: {clientTelp}</p>
                </div>
            </div>

            {/* II. OBJEK PEKERJAAN */}
            <h2 className="text-lg font-semibold mb-3">II. OBJEK PEKERJAAN</h2>
            <p className="mb-4">Pihak Pertama bersedia melaksanakan pembuatan website untuk Pihak Kedua dengan detail berikut:</p>
            <ul className="list-disc ml-6 mb-4">
                <li><span className="font-bold">Jenis Website:</span> {projectName}</li>
                <li><span className="font-bold">Nama Proyek:</span> {projectName}</li>
                <li><span className="font-bold">Deskripsi Singkat Pekerjaan:</span> Pembuatan website {projectName} untuk {clientBusiness}</li>
            </ul>

            {/* III. BIAYA DAN PEMBAYARAN */}
            <h2 className="text-lg font-semibold mb-3">III. BIAYA DAN PEMBAYARAN</h2>
            <p className="mb-4">Total biaya pembuatan website: <span className="font-bold">Rp {formatCurrency(totalPrice)}</span></p>
            
            <p className="font-semibold mb-2">Pembayaran dilakukan dalam 2 tahap:</p>
            <ul className="list-decimal ml-6 mb-4">
                <li>Tahap 1 (DP): 50% dari total biaya saat SPK disetujui.</li>
                <li>Tahap 2 (Pelunasan): 50% setelah website selesai dan diserahkan ke pihak klien.</li>
            </ul>

            <p className="font-semibold mb-2">Pembayaran dilakukan melalui rekening resmi:</p>
            <p>Bank: {bankName}</p>
            <p>No. Rekening: {accountNumber}</p>

            {/* IV. TANGGUNG JAWAB DAN KETENTUAN (Fix Page Break) */}
            <div style={{ breakInside: 'auto' }}>
                {/* FIX: MEMAKSA PAGE BREAK DI SINI */}
                <h2 className="text-lg font-semibold mb-3" style={{ pageBreakBefore: 'always', marginTop: '0' }}>IV. TANGGUNG JAWAB DAN KETENTUAN</h2> 
                
                {/* BLOK 1 */}
                <div style={{ breakInside: 'avoid', marginTop: '0.5rem', marginBottom: '1rem' }}> 
                    <h3 className="font-bold">1. Tanggung Jawab Pihak Pertama (Penyedia Jasa)</h3>
                    <ul className="list-disc ml-6">
                        <li>Menyediakan layanan pembuatan website sesuai brief dan arahan dari klien.</li>
                        <li>Memberikan hasil akhir website dalam kondisi siap digunakan dan bebas dari error mayor saat serah terima.</li>
                        <li>Menjamin seluruh file website (tema, plugin, dan aset desain) legal dan bebas dari lisensi bajakan.</li>
                        <li>Menyimpan data proyek secara aman selama masa pengerjaan.</li>
                        <li>Memberikan dukungan teknis minor selama masa garansi (maksimal 30 hari setelah serah terima).</li>
                    </ul>
                </div>

                {/* BLOK 2 */}
                <div style={{ breakInside: 'avoid', marginTop: '0.5rem', marginBottom: '1rem' }}>
                    <h3 className="font-bold">2. Tanggung Jawab Pihak Kedua (Klien)</h3>
                    <ul className="list-disc ml-6">
                        <li>Menyediakan seluruh bahan (logo, konten, foto, deskripsi produk/jasa, dan informasi bisnis) secara lengkap sebelum pengerjaan dimulai.</li>
                        <li>Melakukan pembayaran sesuai jadwal yang telah disepakati dalam SPK ini.</li>
                        <li>Menyetujui hasil pekerjaan sesuai dengan brief awal; revisi besar atau perubahan struktur website akan dikenakan biaya tambahan.</li>
                        <li>Tidak menuntut pengerjaan di luar scope proyek yang telah disetujui di awal.</li>
                    </ul>
                </div>

                {/* BLOK 3 */}
                <div style={{ breakInside: 'avoid', marginTop: '0.5rem', marginBottom: '1rem' }}>
                    <h3 className="font-bold">3. Ketentuan Tambahan</h3>
                    <ul className="list-disc ml-6">
                        <li>Keterlambatan penyediaan data oleh klien dapat menyebabkan penundaan waktu pengerjaan.</li>
                        <li>Keterlambatan pembayaran lebih dari 7 hari setelah jatuh tempo akan dikenakan denda sebesar 5% dari total proyek.</li>
                        <li>Segala bentuk komunikasi resmi proyek hanya diakui melalui media yang ditentukan oleh pihak penyedia jasa (misal: WhatsApp resmi, dashboard ERP, atau email resmi).</li>
                        <li>Setelah proyek selesai dan diserahkan, hak pengelolaan website sepenuhnya menjadi tanggung jawab klien, kecuali menggunakan layanan maintenance tambahan.</li>
                        <li>Pihak Penyedia Jasa berhak menampilkan hasil proyek ini (tanpa data pribadi) sebagai portofolio dan bahan promosi.</li>
                    </ul>
                </div>
            </div>

            {/* V. PENUTUP DAN TANDA TANGAN (Fix TTD Melar & Alignment) */}
            <div style={{ breakInside: 'avoid', backgroundColor: '#ffffff', marginTop: '3rem' }}> 
                <h2 className="text-lg font-semibold mb-3">V. PENUTUP</h2>
                <p className="mb-4">Dengan ditandatanganinya surat ini, kedua belah pihak sepakat atas seluruh isi perjanjian kerja ini tanpa paksaan dari pihak manapun.</p>
                
                <p className="text-center mb-8" style={{ marginTop: '1rem' }}>Dibuat di <span className="font-bold">{kota}</span>, tanggal <span className="font-bold">{tanggalTtd}</span></p>
                
                <div className="grid grid-cols-2 text-center gap-4 mt-12" style={{ width: '100%' }}>
                    
                    {/* PIHAK PERTAMA (Agency) */}
                    <div className="flex flex-col items-center justify-start h-full">
                        <p className="font-bold mb-1">PIHAK PERTAMA</p>
                        <p className="mb-10 text-xs">({companyName})</p>
                        
                        {/* Kotak TTD/Signature: DIBUAT FIX WIDTH & HEIGHT */}
                        <div className="w-32 h-16 flex items-center justify-center relative" style={{ margin: '1rem 0' }}>
                            {signatureUrl ? (
                                 <img 
                                    src={signatureUrl} 
                                    alt="Signature Agency" 
                                    style={{ 
                                        width: '100%', 
                                        height: '100%', 
                                        objectFit: 'contain',
                                        maxWidth: '128px', 
                                        maxHeight: '64px', 
                                    }}
                                />
                            ) : (
                                 <div className="w-full h-full border border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
                                    (Tanda Tangan Tidak Ada)
                                </div>
                            )}
                        </div>
                        
                        {/* Nama dan Jabatan di bawah garis */}
                        <div className="mt-6 w-40"> 
                            <p className="border-t pt-1 font-semibold text-base">{companyName}</p>
                            <p className="text-sm">Jabatan</p> 
                        </div>
                    </div>

                    {/* PIHAK KEDUA (Klien) */}
                    <div className="w-1/2 flex flex-col items-center justify-start h-full">
                        <p className="font-bold mb-1">PIHAK KEDUA</p>
                        <p className="mb-10 text-xs">({clientName})</p>
                         
                        {/* Kotak TTD Klien */}
                        <div className="w-32 h-16 flex items-center justify-center relative" style={{ margin: '1rem 0' }}>
                            <div className="w-full h-full border border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
                                TTD Klien
                            </div>
                        </div>
                        
                        {/* Nama dan Jabatan di bawah garis */}
                        <div className="mt-6 w-40"> 
                            <p className="border-t pt-1 font-semibold text-base">{clientName}</p>
                            <p className="text-sm">Wakil dari {clientBusiness}</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};