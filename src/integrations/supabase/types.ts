export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_reports: {
          Row: {
              id: string
              report_date: string // date
              revenue: number // numeric
              fee_payment: number // numeric
              net_revenue: number // numeric (input manual/kalkulasi FE)
              ads_spend: number // numeric
              tax_11: number | null // numeric GENERATED (DEFAULT di skema Anda, bukan GENERATED STORED)
              profit_loss: number | null // numeric GENERATED (DEFAULT di skema Anda, bukan GENERATED STORED)
              roas: number | null // numeric GENERATED (DEFAULT di skema Anda, bukan GENERATED STORED)
              leads: number // integer
              total_purchase: number // integer
              conv_percent: number | null // numeric GENERATED (DEFAULT di skema Anda, bukan GENERATED STORED)
              cost_per_lead: number | null // numeric GENERATED (DEFAULT di skema Anda, bukan GENERATED STORED)
              cost_per_purchase: number | null // numeric GENERATED (DEFAULT di skema Anda, bukan GENERATED STORED)
              week: number | null // integer
              month: string | null // text
              created_at: string // timestamp with time zone
              created_by: string | null // uuid
          }
          Insert: {
              id?: string
              report_date: string // date
              revenue?: number // numeric
              fee_payment?: number // numeric
              net_revenue: number // numeric (kirim ini agar default terhitung benar)
              ads_spend?: number // numeric
              // Kolom default/generated tidak perlu di Insert jika DB menghitungnya
              // tax_11?: number | null
              // profit_loss?: number | null
              // roas?: number | null
              leads?: number // integer
              total_purchase?: number // integer
              // conv_percent?: number | null
              // cost_per_lead?: number | null
              // cost_per_purchase?: number | null
              week?: number | null // integer
              month?: string | null // text
              created_at?: string // timestamp with time zone
              created_by?: string | null // uuid
          }
          Update: {
              id?: string
              report_date?: string // date
              revenue?: number // numeric
              fee_payment?: number // numeric
              net_revenue?: number // numeric (kirim ini agar default terhitung benar)
              ads_spend?: number // numeric
              // Kolom default/generated tidak perlu di Update jika DB menghitungnya
              leads?: number // integer
              total_purchase?: number // integer
              week?: number | null // integer
              month?: string | null // text
              created_at?: string // timestamp with time zone
              created_by?: string | null // uuid
          }
          Relationships: [
            {
              foreignKeyName: "ads_reports_created_by_fkey"
              columns: ["created_by"]
              isOneToOne: false
              referencedRelation: "users"
              referencedColumns: ["id"]
            },
          ]
        }
      clients: {
        Row: {
          alamat: string | null
          bisnis: string | null
          catatan: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          nama: string
          phone: string | null
          renewal_date: string | null
          status: Database["public"]["Enums"]["client_status"] | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          alamat?: string | null
          bisnis?: string | null
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nama: string
          phone?: string | null
          renewal_date?: string | null
          status?: Database["public"]["Enums"]["client_status"] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          alamat?: string | null
          bisnis?: string | null
          catatan?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nama?: string
          phone?: string | null
          renewal_date?: string | null
          status?: Database["public"]["Enums"]["client_status"] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          follow_up_date: string | null
          id: string
          notes: string
          subject: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          follow_up_date?: string | null
          id?: string
          notes: string
          subject?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          follow_up_date?: string | null
          id?: string
          notes?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          alamat: string | null
          created_at: string
          id: string
          logo_url: string | null
          nama: string
          npwp: string | null
          rekening: string | null
          signature_url: string | null
          updated_at: string
          email?: string | null // Tambahan dari asumsi sebelumnya
          telp?: string | null // Tambahan dari asumsi sebelumnya
        }
        Insert: {
          alamat?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nama: string
          npwp?: string | null
          rekening?: string | null
          signature_url?: string | null
          updated_at?: string
          email?: string | null
          telp?: string | null
        }
        Update: {
          alamat?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          nama?: string
          npwp?: string | null
          rekening?: string | null
          signature_url?: string | null
          updated_at?: string
          email?: string | null
          telp?: string | null
        }
        Relationships: []
      }
      developer_payments_tracking: {
        Row: {
          amount_paid: number
          developer_id: string
          id: string
          notes: string | null
          paid_at: string
          project_id: string
        }
        Insert: {
          amount_paid: number
          developer_id: string
          id?: string
          notes?: string | null
          paid_at?: string
          project_id: string
        }
        Update: {
          amount_paid?: number
          developer_id?: string
          id?: string
          notes?: string | null
          paid_at?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_payments_tracking_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_payments_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      finances: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          kategori: Database["public"]["Enums"]["finance_category"]
          keterangan: string | null
          nominal: number
          tanggal: string
          tipe: Database["public"]["Enums"]["finance_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          kategori: Database["public"]["Enums"]["finance_category"]
          keterangan?: string | null
          nominal: number
          tanggal?: string
          tipe: Database["public"]["Enums"]["finance_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          kategori?: Database["public"]["Enums"]["finance_category"]
          keterangan?: string | null
          nominal?: number
          tanggal?: string
          tipe?: Database["public"]["Enums"]["finance_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finances_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_number: string
          jatuh_tempo: string
          paid_at: string | null
          pdf_url: string | null
          project_id: string
          status: Database["public"]["Enums"]["invoice_status"] | null
          tanggal_terbit: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number: string
          jatuh_tempo: string
          paid_at?: string | null
          pdf_url?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          tanggal_terbit?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string
          jatuh_tempo?: string
          paid_at?: string | null
          pdf_url?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          tanggal_terbit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          catatan: string | null
          client_id: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          id: string
          kontak: string
          nama: string
          sumber: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"] | null
          updated_at: string
        }
        Insert: {
          catatan?: string | null
          client_id?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kontak: string
          nama: string
          sumber: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string
        }
        Update: {
          catatan?: string | null
          client_id?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kontak?: string
          nama?: string
          sumber?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          deskripsi: string | null
          estimasi_hari: number | null
          fitur: Json | null
          harga: number
          id: string
          is_active: boolean | null
          nama: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deskripsi?: string | null
          estimasi_hari?: number | null
          fitur?: Json | null
          harga: number
          id?: string
          is_active?: boolean | null
          nama: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deskripsi?: string | null
          estimasi_hari?: number | null
          fitur?: Json | null
          harga?: number
          id?: string
          is_active?: boolean | null
          nama?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_checklists: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          project_id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          project_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          project_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_checklists_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          developer_id: string | null
          estimasi_hari: number | null
          fee_developer: number | null
          harga: number
          id: string
          is_archived: boolean
          nama_proyek: string
          package_id: string | null
          progress: number | null
          progress_notes: string | null
          ruang_lingkup: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          tanggal_mulai: string | null
          tanggal_selesai: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          developer_id?: string | null
          estimasi_hari?: number | null
          fee_developer?: number | null
          harga: number
          id?: string
          is_archived?: boolean
          nama_proyek: string
          package_id?: string | null
          progress?: number | null
          progress_notes?: string | null
          ruang_lingkup?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          tanggal_mulai?: string | null
          tanggal_selesai?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          developer_id?: string | null
          estimasi_hari?: number | null
          fee_developer?: number | null
          harga?: number
          id?: string
          is_archived?: boolean
          nama_proyek?: string
          package_id?: string | null
          progress?: number | null
          progress_notes?: string | null
          ruang_lingkup?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          tanggal_mulai?: string | null
          tanggal_selesai?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_developer_id_fkey"
            columns: ["developer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      spks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          payment_terms: string | null
          pdf_url: string | null
          project_id: string
          spk_number: string
          terms_conditions: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          payment_terms?: string | null
          pdf_url?: string | null
          project_id: string
          spk_number: string
          terms_conditions?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          payment_terms?: string | null
          pdf_url?: string | null
          project_id?: string
          spk_number?: string
          terms_conditions?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users" // Merujuk ke tabel 'users' di skema 'auth'
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_or_finance: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_finance: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      client_status: "prospek" | "negosiasi" | "deal" | "aktif" | "selesai"
      finance_category:
        | "pendapatan"
        | "operasional"
        | "gaji"
        | "pajak"
        | "hosting"
        | "iklan"
        | "lainnya"
      finance_type: "income" | "expense"
      invoice_status:
        | "draft"
        | "menunggu_dp"
        | "lunas_dp"
        | "menunggu_pelunasan"
        | "lunas"
        | "overdue"
        | "batal"
      lead_source: "website" | "referral" | "iklan" | "sosmed" | "lainnya"
      lead_status: "baru" | "follow_up" | "negosiasi" | "deal" | "gagal"
      project_status:
        | "briefing"
        | "desain"
        | "development"
        | "revisi"
        | "launch"
        | "selesai"
      user_role: "admin" | "cs" | "developer" | "finance" // Pastikan enum ini ada di DB Anda
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types (tidak perlu diubah)
type PublicSchema = Database[Extract<keyof Database, "public">]
// ... (Tables, TablesInsert, TablesUpdate, Enums sama seperti sebelumnya) ...
export type Tables< PublicTableNameOrOptions extends | keyof (PublicSchema["Tables"] & PublicSchema["Views"]) | { schema: keyof Database }, TableName extends PublicTableNameOrOptions extends { schema: keyof Database } ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] & Database[PublicTableNameOrOptions["schema"]]["Views"]) : never = never > = PublicTableNameOrOptions extends { schema: keyof Database } ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] & Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] & PublicSchema["Views"]) ? (PublicSchema["Tables"] & PublicSchema["Views"])[PublicTableNameOrOptions] extends { Row: infer R } ? R : never : never
export type TablesInsert< PublicTableNameOrOptions extends | keyof PublicSchema["Tables"] | { schema: keyof Database }, TableName extends PublicTableNameOrOptions extends { schema: keyof Database } ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"] : never = never > = PublicTableNameOrOptions extends { schema: keyof Database } ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never : PublicTableNameOrOptions extends keyof PublicSchema["Tables"] ? PublicSchema["Tables"][PublicTableNameOrOptions] extends { Insert: infer I } ? I : never : never
export type TablesUpdate< PublicTableNameOrOptions extends | keyof PublicSchema["Tables"] | { schema: keyof Database }, TableName extends PublicTableNameOrOptions extends { schema: keyof Database } ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"] : never = never > = PublicTableNameOrOptions extends { schema: keyof Database } ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never : PublicTableNameOrOptions extends keyof PublicSchema["Tables"] ? PublicSchema["Tables"][PublicTableNameOrOptions] extends { Update: infer U } ? U : never : never
export type Enums< PublicEnumNameOrOptions extends | keyof PublicSchema["Enums"] | { schema: keyof Database }, EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database } ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"] : never = never > = PublicEnumNameOrOptions extends { schema: keyof Database } ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName] : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"] ? PublicSchema["Enums"][PublicEnumNameOrOptions] : never

// --- Alias Tipe Spesifik ---
export type AdsReport = Database['public']['Tables']['ads_reports']['Row'];
export type AdsReportInsert = Database['public']['Tables']['ads_reports']['Insert'];
export type Client = Database['public']['Tables']['clients']['Row'];
export type ClientInsert = Database['public']['Tables']['clients']['Insert'];
export type Communication = Database['public']['Tables']['communications']['Row'];
export type CommunicationInsert = Database['public']['Tables']['communications']['Insert'];
export type Company = Database['public']['Tables']['companies']['Row'];
export type CompanyInsert = Database['public']['Tables']['companies']['Insert'];
export type DeveloperPaymentTracking = Database['public']['Tables']['developer_payments_tracking']['Row'];
export type DeveloperPaymentTrackingInsert = Database['public']['Tables']['developer_payments_tracking']['Insert'];
export type Finance = Database['public']['Tables']['finances']['Row'];
export type FinanceInsert = Database['public']['Tables']['finances']['Insert'];
export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];
export type Lead = Database['public']['Tables']['leads']['Row'];
export type LeadInsert = Database['public']['Tables']['leads']['Insert'];
export type Package = Database['public']['Tables']['packages']['Row'];
export type PackageInsert = Database['public']['Tables']['packages']['Insert'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProjectChecklist = Database['public']['Tables']['project_checklists']['Row'];
export type ProjectChecklistInsert = Database['public']['Tables']['project_checklists']['Insert'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type SPK = Database['public']['Tables']['spks']['Row'];
export type SPKInsert = Database['public']['Tables']['spks']['Insert'];
export type UserRole = Database['public']['Tables']['user_roles']['Row'];
export type UserRoleInsert = Database['public']['Tables']['user_roles']['Insert'];

// Enums
export type client_status = Database['public']['Enums']['client_status'];
export type finance_category = Database['public']['Enums']['finance_category'];
export type finance_type = Database['public']['Enums']['finance_type'];
export type invoice_status = Database['public']['Enums']['invoice_status'];
export type lead_source = Database['public']['Enums']['lead_source'];
export type lead_status = Database['public']['Enums']['lead_status'];
export type project_status = Database['public']['Enums']['project_status'];
export type user_role = Database['public']['Enums']['user_role'];