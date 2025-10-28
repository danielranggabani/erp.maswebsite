/**
 * Menghasilkan nomor unik dengan format PREFIX-YYYYMMDD-RAND4.
 * Contoh: INV-20251020-4567 atau SPK-20251020-1234
 * * @param prefix 'INV' untuk Invoice atau 'SPK' untuk Surat Perjanjian Kerja
 * @returns String nomor unik
 */
export function generateUniqueNumber(prefix: 'INV' | 'SPK'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // Menghasilkan 4 digit angka random antara 1000 sampai 9999
  const rand4 = String(Math.floor(Math.random() * 9000) + 1000);
  
  return `${prefix}-${year}${month}${day}-${rand4}`;
}