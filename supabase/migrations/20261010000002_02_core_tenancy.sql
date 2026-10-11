-- 02. Core Tenancy, Configurations, and Profiles

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM public, anon, authenticated;
GRANT SELECT, UPDATE (full_name) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.business_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT
);
ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_categories FROM public, anon, authenticated;
GRANT SELECT ON public.business_categories TO authenticated;

CREATE TABLE public.country_configurations (
    country_code TEXT CHECK (country_code ~ '^[A-Z]{2}$'),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    currency_code TEXT NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    effective_to TIMESTAMPTZ,
    PRIMARY KEY (country_code, effective_from)
);
ALTER TABLE public.country_configurations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.country_configurations FROM public, anon, authenticated;
GRANT SELECT ON public.country_configurations TO authenticated;

CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category_id UUID REFERENCES public.business_categories(id),
    country_code TEXT,
    provisioning_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT org_id_unique UNIQUE (id),
    CONSTRAINT slug_format CHECK (
        slug ~ '^[a-z0-9](-?[a-z0-9]){1,61}[a-z0-9]$'
        AND slug NOT IN ('admin', 'api', 'app', 'auth', 'billing', 'support', 'www', 'mybusiness')
    )
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizations FROM public, anon, authenticated;
GRANT SELECT, UPDATE ON public.organizations TO authenticated;

CREATE TABLE public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    host TEXT NOT NULL UNIQUE,
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
    UNIQUE (organization_id, id)
);
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.domains FROM public, anon, authenticated;
GRANT SELECT ON public.domains TO authenticated;
