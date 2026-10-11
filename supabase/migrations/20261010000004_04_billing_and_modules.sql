-- 04. Billing, Modules, Entitlements

CREATE TABLE public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    price NUMERIC NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plans FROM public, anon, authenticated;
GRANT SELECT ON public.plans TO authenticated;

CREATE TABLE public.entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key TEXT NOT NULL UNIQUE
);
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.entitlements FROM public, anon, authenticated;
GRANT SELECT ON public.entitlements TO authenticated;

CREATE TABLE public.plan_entitlements (
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    entitlement_id UUID NOT NULL REFERENCES public.entitlements(id) ON DELETE CASCADE,
    PRIMARY KEY (plan_id, entitlement_id)
);
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_entitlements FROM public, anon, authenticated;
GRANT SELECT ON public.plan_entitlements TO authenticated;

CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
    trial_end TIMESTAMPTZ,
    UNIQUE (organization_id)
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscriptions FROM public, anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

CREATE TABLE public.modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.modules FROM public, anon, authenticated;
GRANT SELECT ON public.modules TO authenticated;

CREATE TABLE public.organization_modules (
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',
    PRIMARY KEY (organization_id, module_id)
);
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_modules FROM public, anon, authenticated;
GRANT SELECT ON public.organization_modules TO authenticated;
