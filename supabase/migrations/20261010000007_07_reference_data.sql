-- 07. Reference Data

INSERT INTO public.permissions (id, module_name, action)
VALUES 
    ('manage_team', 'core', 'manage_team'),
    ('audit:read', 'core', 'audit:read')
ON CONFLICT (id) DO NOTHING;
