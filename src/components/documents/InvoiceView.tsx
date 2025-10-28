import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Database } from '@/integrations/supabase/types';

type Invoice = Database['public']['Tables']['invoices']['Row'] & { 
  projects: { nama_proyek: string, client_id: string, clients: { nama: string, bisnis: string } | null } | null;
  clients: { nama: string, bisnis: string } | null; 
};
type Company = Database['public']['Tables']['companies']['Row']; 

interface InvoiceViewProps {
  invoice: Invoice;
  company: Company | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

export const InvoiceView: React.FC<InvoiceViewProps> = ({ invoice, company }) => {
  
    const total = invoice.amount || 0;
    const clientName = invoice.clients?.nama || 'N/A Client';
    const clientBusiness = invoice.clients?.bisnis || 'N/A Business';
    const projectName = invoice.projects?.nama_proyek || 'Proyek Umum';
    
    // Simulasikan detail item (sesuai permintaan: ambil paket/proyek)
    const items = [
        { 
            description: `Jasa Pembuatan Website Paket: ${projectName}`, 
            amount: total 
        }
    ];

    return (
        <Card className="p-0 border-none shadow-none">
            <CardContent className="p-0 space-y-6">
                
                {/* HEADER (AD4TECH + LOGO) */}
                <header className="flex justify-between items-start border-b-2 pb-4">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold">{company?.nama || 'WebForge Material LLC'}</h2>
                        <p className="text-sm">{company?.alamat || 'Alamat Perusahaan'}</p>
                        <p className="text-sm">Email: <span className='text-blue-600'>admin@maswebsite.id</span></p>
                    </div>
                    <div className="flex flex-col items-end">
                        <h1 className="text-3xl font-extrabold text-blue-600">INVOICE</h1>
                        {/* Simulasikan Logo - Anda harus memastikan /download-files/logo.png ada di folder public/ */}
                        {company?.logo_url && (
                            <img src={company.logo_url} alt="Logo" className="w-24 h-auto mt-2" />
                        )}
                    </div>
                </header>

                {/* BILLING INFO & DATES */}
                <section className="grid grid-cols-3 text-sm border p-4 rounded-lg bg-gray-50">
                    <div className="col-span-2 space-y-1">
                        <p className="font-bold border-b pb-1">Tagihan Kepada (Bill To)</p>
                        <p className="font-semibold">{clientName}</p>
                        <p className="text-xs">{clientBusiness}</p>
                    </div>
                    <div className="col-span-1 space-y-1 text-right">
                        <p><strong>Invoice No:</strong> {invoice.invoice_number}</p>
                        <p><strong>Invoice Date:</strong> {invoice.tanggal_terbit}</p>
                        <p className="text-red-600"><strong>Due Date:</strong> {invoice.jatuh_tempo}</p>
                    </div>
                </section>

                {/* ITEM TABLE */}
                <Table>
                    <TableHeader className="bg-blue-600 text-white">
                        <TableRow className="border-b-blue-700">
                            <TableHead className="text-white">Sl. Description</TableHead>
                            <TableHead className="text-white text-right w-[15%]">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell className="text-right font-bold">Subtotal</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
                
                {/* PAYMENT SUMMARY */}
                <div className="flex justify-end pt-4">
                    <Card className="w-full max-w-sm">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex justify-between font-bold">
                                <span>Total Tagihan:</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-lg font-extrabold">
                                <span>Balance Due:</span>
                                <span className="text-red-600">{formatCurrency(total)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* INSTRUCTIONS */}
                <section className="text-sm pt-4">
                    <p className="font-bold">Payment Instructions:</p>
                    <p>{company?.rekening || 'Transfer ke Rekening Bank BCA a.n. PT WebForge.'}</p>
                    <p className="mt-4 text-xs text-muted-foreground">Dokumen ini sah tanpa tanda tangan karena dihasilkan secara elektronik.</p>
                </section>
            </CardContent>
        </Card>
    );
}