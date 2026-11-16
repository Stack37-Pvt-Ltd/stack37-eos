import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthShell } from '../../src/components/auth/auth-shell';
import { LoginForm } from '../../src/components/auth/login-form';
import { SignupForm } from '../../src/components/auth/signup-form';
import { ForgotPasswordForm } from '../../src/components/auth/forgot-password-form';
import { ResetPasswordForm } from '../../src/components/auth/reset-password-form';
import { VerifyEmailCard } from '../../src/components/auth/verify-email-card';
import { ConfirmCard } from '../../src/components/auth/confirm-card';
import { RegistrationForm } from '../../src/components/organization/registration-form';
import { RegistrationShell } from '../../src/components/organization/registration-shell';
import { BusinessConfigurationForm } from '../../src/components/tenant/business-configuration-form';
import { WorkspaceFrame } from '../../src/components/tenant/workspace-frame';
import { WorkspaceOverview } from '../../src/components/tenant/workspace-overview';
import { WorkspaceDirectory } from '../../src/components/tenant/workspace-directory';
import { TenantAccessDenied } from '../../src/components/tenant/access-denied';
import { Button } from '../../src/components/ui/button';
import { Brand } from '../../src/components/ui/brand';
import type { BusinessConfigurationData } from '../../src/lib/auth/business-config';
import type { WorkspaceOperationalData } from '../../src/lib/auth/workspace-context';

declare global {
  interface Window { __qa: { mode: string; calls: {name: string; input: unknown}[]; navigation: string[] }; }
}
window.__qa = { mode: 'success', calls: [], navigation: [] };
const params = new URLSearchParams(location.search);
const screen = params.get('screen') || (location.pathname === '/settings' ? 'settings' : 'overview');
const organizations = [
  { id:'org-1', name:'Serendib Supply Company', slug:'serendib', provisioning_status:'ready', is_owner:true, status:'active' },
  { id:'org-2', name:'Northline Traders', slug:'northline', provisioning_status:'ready', is_owner:false, status:'active' },
];
const config: BusinessConfigurationData = {
  organization: {
    id:'org-1', name:'Serendib Supply Company', slug:'serendib', legalName:'Serendib Supply (Pvt) Ltd', registrationNumber:'PV 123456', categoryId:'retail', categoryName:'Retail',
    countryCode:'LK', currency:'LKR', timezone:'Asia/Colombo', suggestedCurrency:'LKR', suggestedTimezone:'Asia/Colombo', taxId:'123456789', taxStatus:'standard',
    contactEmail:'hello@example.test', contactPhone:'+94 11 123 4567', website:'https://example.test', addressLine1:'24 Galle Road', addressLine2:'', city:'Colombo', stateProvince:'Western', postalCode:'00300', uberCommissionRate:null, pickmeCommissionRate:null, createdAt:'2026-10-13',
  },
  headquartersBranch: { id:'hq-1', name:'Headquarters', code:'HQ', isHeadquarters:true, isOwnerAssigned:true, contactEmail:'hq@example.test', contactPhone:'+94 11 123 4567', addressLine1:'24 Galle Road', addressLine2:'', city:'Colombo', stateProvince:'Western', postalCode:'00300' },
  categories:[{id:'retail',name:'Retail'},{id:'services',name:'Services'}],
  canEdit:params.get('readonly') !== '1',
};
const data: WorkspaceOperationalData = {
  organization:{id:'org-1',name:config.organization.name,slug:'serendib',countryCode:'LK',provisioningStatus:'ready',createdAt:'2026-10-13'},
  membership:{id:'mem-1',isOwner:true,status:'active'},
  subscription:{planName:'Standard',price:0,status:'trialing',trialEnd:'2026-10-20',daysRemaining:7,isTrialActive:true},
  branches:[{id:'hq-1',name:'Headquarters',isAssigned:true}],assignedBranch:{id:'hq-1',name:'Headquarters',isAssigned:true},
  roles:[{id:'admin',name:'Administrator',isSystem:true}],permissions:['organization.view','organization.manage'],
};
const authScreens: Record<string, React.ReactNode> = {
  login:<LoginForm />, register:<SignupForm />, forgot:<ForgotPasswordForm />, reset:<ResetPasswordForm />,
  verify:<VerifyEmailCard />, confirm:<ConfirmCard />, registration:<RegistrationForm userEmail="owner@example.test" />,
};
let content: React.ReactNode;
if (screen === 'registration') content = <RegistrationShell email="owner@example.test">{authScreens[screen]}</RegistrationShell>;
else if (authScreens[screen]) content = <AuthShell>{authScreens[screen]}</AuthShell>;
else if (screen === 'directory') content = <><header className="app-header"><div className="app-container py-4"><Brand compact /></div></header><main className="app-container py-10"><WorkspaceDirectory organizations={params.get('empty') ? [] : organizations} host="localhost:3002" /></main></>;
else if (screen === 'denied') content = <TenantAccessDenied tenantSlug="serendib" reason="not_a_member" userEmail="member@example.test" />;
else content = <WorkspaceFrame organization={organizations[0]} organizations={organizations} host="localhost:3002" email="owner@example.test" isOwner={config.canEdit} accountActions={<Button variant="outline" size="sm">Sign out</Button>}>
  {screen === 'settings' ? <><p className="eyebrow mb-3">Business settings</p><h1 className="mb-2 text-3xl font-semibold tracking-tight">Business settings</h1><p className="mb-8 text-sm text-slate-600">Business profile and operating details.</p><BusinessConfigurationForm initialData={config} /></> : <WorkspaceOverview organization={organizations[0]} membership={{is_owner:true,status:'active'}} data={data} />}
</WorkspaceFrame>;
createRoot(document.getElementById('root')!).render(<>
  <div className="flex flex-wrap items-center gap-3 border-b border-slate-300 bg-slate-100 p-3 text-xs text-slate-700">
    <strong>LOCAL UI REVIEW · Mocked data/actions</strong>
    <label>Screen <select aria-label="Review screen" defaultValue={screen} onChange={e=>{location.href='/?screen='+e.target.value;}} className="border bg-white p-1">
      {['login','register','forgot','reset','verify','confirm','registration','directory','overview','settings','denied'].map(s=><option key={s}>{s}</option>)}
    </select></label>
    <label>Reply <select aria-label="Mock response" onChange={e=>{window.__qa.mode=e.target.value;}} className="border bg-white p-1"><option>success</option><option>error</option><option>field</option><option>slow</option></select></label>
  </div>{content}<details className="border-t bg-slate-100 p-3 text-xs"><summary>Mock action log</summary><pre id="qa-events" className="mt-2 whitespace-pre-wrap break-all">No actions yet.</pre></details>
</>);
