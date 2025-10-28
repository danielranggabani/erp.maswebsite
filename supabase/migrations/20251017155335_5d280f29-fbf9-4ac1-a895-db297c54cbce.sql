-- Drop existing types if they exist and recreate
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'cs', 'developer', 'finance');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE client_status AS ENUM ('prospek', 'negosiasi', 'deal', 'aktif', 'selesai');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('briefing', 'desain', 'development', 'revisi', 'launch', 'selesai');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'menunggu_dp', 'lunas', 'overdue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('baru', 'tertarik', 'negosiasi', 'closing', 'gagal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM ('facebook', 'google', 'whatsapp', 'website', 'referral', 'lainnya');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE finance_type AS ENUM ('income', 'expense');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE finance_category AS ENUM ('pendapatan', 'operasional', 'pajak', 'gaji', 'hosting', 'iklan', 'lainnya');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User roles table (separate for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'cs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Company settings
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  alamat TEXT,
  npwp TEXT,
  rekening TEXT,
  logo_url TEXT,
  signature_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Packages/Products
CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  harga DECIMAL(15,2) NOT NULL,
  deskripsi TEXT,
  fitur JSONB,
  estimasi_hari INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clients/CRM
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  bisnis TEXT,
  status client_status DEFAULT 'prospek',
  catatan TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  kontak TEXT NOT NULL,
  sumber lead_source NOT NULL,
  status lead_status DEFAULT 'baru',
  catatan TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_proyek TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.packages(id),
  harga DECIMAL(15,2) NOT NULL,
  status project_status DEFAULT 'briefing',
  ruang_lingkup TEXT,
  tanggal_mulai DATE,
  tanggal_selesai DATE,
  estimasi_hari INTEGER,
  developer_id UUID REFERENCES auth.users(id),
  progress_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SPK (Surat Perjanjian Kerja)
CREATE TABLE IF NOT EXISTS public.spks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spk_number TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pdf_url TEXT,
  terms_conditions TEXT,
  payment_terms TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  status invoice_status DEFAULT 'draft',
  tanggal_terbit DATE NOT NULL DEFAULT CURRENT_DATE,
  jatuh_tempo DATE NOT NULL,
  pdf_url TEXT,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Finances
CREATE TABLE IF NOT EXISTS public.finances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe finance_type NOT NULL,
  kategori finance_category NOT NULL,
  nominal DECIMAL(15,2) NOT NULL,
  keterangan TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Communication history
CREATE TABLE IF NOT EXISTS public.communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  subject TEXT,
  notes TEXT NOT NULL,
  follow_up_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
DO $$ 
BEGIN
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.spks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Everyone can view company settings" ON public.companies;
DROP POLICY IF EXISTS "Only admins can modify company settings" ON public.companies;
DROP POLICY IF EXISTS "Everyone can view active packages" ON public.packages;
DROP POLICY IF EXISTS "Admins can manage packages" ON public.packages;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "CS and admins can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.leads;
DROP POLICY IF EXISTS "CS and admins can manage leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Admins and CS can create projects" ON public.projects;
DROP POLICY IF EXISTS "Admins, CS, and assigned developers can update projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can view SPKs" ON public.spks;
DROP POLICY IF EXISTS "Admins can manage SPKs" ON public.spks;
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins and finance can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can view finances" ON public.finances;
DROP POLICY IF EXISTS "Admins and finance can manage finances" ON public.finances;
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can view communications" ON public.communications;
DROP POLICY IF EXISTS "CS and admins can manage communications" ON public.communications;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for companies
CREATE POLICY "Everyone can view company settings"
  ON public.companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify company settings"
  ON public.companies FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for packages
CREATE POLICY "Everyone can view active packages"
  ON public.packages FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage packages"
  ON public.packages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for clients
CREATE POLICY "Authenticated users can view clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "CS and admins can manage clients"
  ON public.clients FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'cs')
  );

-- RLS Policies for leads
CREATE POLICY "Authenticated users can view leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "CS and admins can manage leads"
  ON public.leads FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'cs')
  );

-- RLS Policies for projects
CREATE POLICY "Authenticated users can view projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and CS can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'cs')
  );

CREATE POLICY "Admins, CS, and assigned developers can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'cs') OR
    developer_id = auth.uid()
  );

-- RLS Policies for SPKs
CREATE POLICY "Authenticated users can view SPKs"
  ON public.spks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage SPKs"
  ON public.spks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for invoices
CREATE POLICY "Authenticated users can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and finance can manage invoices"
  ON public.invoices FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finance')
  );

-- RLS Policies for finances
CREATE POLICY "Authenticated users can view finances"
  ON public.finances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and finance can manage finances"
  ON public.finances FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'finance')
  );

-- RLS Policies for activity_logs
CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for communications
CREATE POLICY "Authenticated users can view communications"
  ON public.communications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "CS and admins can manage communications"
  ON public.communications FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'cs')
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS set_updated_at ON public.companies;
DROP TRIGGER IF EXISTS set_updated_at ON public.packages;
DROP TRIGGER IF EXISTS set_updated_at ON public.clients;
DROP TRIGGER IF EXISTS set_updated_at ON public.leads;
DROP TRIGGER IF EXISTS set_updated_at ON public.projects;
DROP TRIGGER IF EXISTS set_updated_at ON public.spks;
DROP TRIGGER IF EXISTS set_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS set_updated_at ON public.finances;

-- Add triggers for updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.spks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.finances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_user_roles_user_id;
DROP INDEX IF EXISTS idx_clients_status;
DROP INDEX IF EXISTS idx_leads_status;
DROP INDEX IF EXISTS idx_projects_status;
DROP INDEX IF EXISTS idx_projects_developer;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_finances_tanggal;
DROP INDEX IF EXISTS idx_finances_tipe;
DROP INDEX IF EXISTS idx_activity_logs_created_at;

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_developer ON public.projects(developer_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_finances_tanggal ON public.finances(tanggal);
CREATE INDEX idx_finances_tipe ON public.finances(tipe);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);