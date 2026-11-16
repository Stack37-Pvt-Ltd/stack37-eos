'use client';

import Link from 'next/link';
import {
  BarChart3,
  ShieldCheck,
  Store,
  Tag,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';

export const retailModuleSections = [
  { id: 'purchasing', label: 'Purchasing', icon: Truck },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'branches', label: 'Branches', icon: Store },
  { id: 'promotions', label: 'Loyalty & offers', icon: Tag },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'controls', label: 'Controls', icon: ShieldCheck },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: LucideIcon }>;

export type RetailModuleSection = (typeof retailModuleSections)[number]['id'];

type ModuleDefinition = {
  title: string;
  description: string;
  action: string;
  secondaryAction?: string;
  search: string;
  metrics: readonly [string, string, string];
  columns: readonly [string, string, string, string];
  detail: string;
};

const moduleDefinitions: Record<RetailModuleSection, ModuleDefinition> = {
  purchasing: {
    title: 'Purchasing & suppliers', description: 'Organize suppliers, purchase orders and goods received.',
    action: 'New purchase order', secondaryAction: 'Add supplier', search: 'Search orders or suppliers',
    metrics: ['Open orders', 'Awaiting delivery', 'Suppliers'], columns: ['Order', 'Supplier', 'Date', 'Status'],
    detail: 'Orders, supplier balances and receiving records will appear when purchasing is connected.',
  },
  customers: {
    title: 'Customers', description: 'Keep customer details and purchase history together.',
    action: 'Add customer', search: 'Search customer name or phone',
    metrics: ['Customers', 'Recent customers', 'Purchase history'], columns: ['Customer', 'Contact', 'Last purchase', 'Status'],
    detail: 'Customer profiles and purchase history will appear when customer management is connected.',
  },
  expenses: {
    title: 'Expenses & petty cash', description: 'Track operating expenses and cash payouts.',
    action: 'Record expense', search: 'Search expenses',
    metrics: ['Expenses today', 'This month', 'Pending review'], columns: ['Expense', 'Category', 'Date', 'Amount'],
    detail: 'Expenses and petty cash records will appear when this feature is connected.',
  },
  branches: {
    title: 'Branches', description: 'See operating locations and their stock activity.',
    action: 'Add branch', secondaryAction: 'Transfer stock', search: 'Search locations',
    metrics: ['Locations', 'Stock transfers', 'Low-stock items'], columns: ['Location', 'Type', 'Stock activity', 'Status'],
    detail: 'Location details and stock transfers will appear when branch operations are connected.',
  },
  promotions: {
    title: 'Loyalty & offers', description: 'Manage customer rewards and retail promotions.',
    action: 'Create promotion', search: 'Search offers',
    metrics: ['Active offers', 'Loyalty members', 'Rewards'], columns: ['Offer', 'Applies to', 'Period', 'Status'],
    detail: 'Offers and loyalty information will appear when promotions are connected.',
  },
  reports: {
    title: 'Reports', description: 'Review sales, purchasing and inventory performance.',
    action: 'Export report', search: 'Search reports',
    metrics: ['Sales', 'Inventory value', 'Expenses'], columns: ['Report', 'Period', 'Location', 'Availability'],
    detail: 'Reports will be available once the relevant operational data is connected.',
  },
  controls: {
    title: 'Business controls', description: 'Review operational access, audit activity and till controls.',
    action: 'Review controls', search: 'Search controls',
    metrics: ['Access', 'Audit activity', 'Till reconciliation'], columns: ['Control', 'Area', 'Last activity', 'Status'],
    detail: 'Control and reconciliation information will appear when those features are connected.',
  },
};

export function isRetailModuleSection(value: string): value is RetailModuleSection {
  return retailModuleSections.some((section) => section.id === value);
}

export function RetailModuleTabs({ selected, onSelect }: {
  selected: string;
  onSelect: (section: RetailModuleSection) => void;
}) {
  return <>
    {retailModuleSections.map(({ id, label, icon: Icon }) => <button
      key={id}
      type="button"
      aria-pressed={selected === id}
      onClick={() => onSelect(id)}
      className={`inline-flex min-h-10 shrink-0 items-center gap-2 border px-3 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${selected === id ? 'border-brand-blue bg-blue-50 font-semibold text-brand-navy' : 'border-brand-line bg-white text-slate-600 hover:bg-slate-50'}`}
    ><Icon aria-hidden="true" className="h-4 w-4" />{label}</button>)}
  </>;
}

type RetailBranch = { id: string; name: string };
type RetailProduct = { id: string; name: string; sku: string; barcode: string | null; selling_price: number; quantity: number };
type RetailDashboard = { salesToday: number; grossSalesToday: number; itemsSoldToday: number; activeProducts: number; lowStockProducts: number; pendingDraftReviews: number; currency: string };

export function RetailModulePanel({ section, organizationSlug, branches = [], branchId, products = [], dashboard }: {
  section: RetailModuleSection;
  organizationSlug: string;
  branches?: RetailBranch[];
  branchId?: string | null;
  products?: RetailProduct[];
  dashboard?: RetailDashboard | null;
}) {
  const definition = moduleDefinitions[section];
  const statusId = `retail-module-status-${section}`;

  if (section === 'branches') {
    return <section aria-labelledby="retail-module-title" className="min-w-0 space-y-5">
      <div>
        <p className="eyebrow mb-2">Retail &amp; E-Commerce operations</p>
        <h2 id="retail-module-title" className="text-2xl font-semibold tracking-tight text-brand-navy">Assigned branches</h2>
        <p className="mt-2 text-sm text-slate-600">Locations available to your account. Select a branch to open its POS, stock and sales dashboard.</p>
      </div>
      {branches.length ? <div className="divide-y divide-brand-line border border-brand-line bg-white">
        {branches.map((branch) => <div key={branch.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium text-brand-navy">{branch.name}</p><p className="mt-1 text-xs text-slate-500">{branch.id === branchId ? 'Currently selected' : 'Assigned to your account'}</p></div>
          <Button asChild variant={branch.id === branchId ? 'outline' : 'primary'}><Link href={`/w/${encodeURIComponent(organizationSlug)}/retail?branch=${encodeURIComponent(branch.id)}`}>{branch.id === branchId ? 'Open this branch' : 'Switch to branch'}</Link></Button>
        </div>)}
      </div> : <Alert variant="warning" title="No assigned branches">Ask a workspace administrator to assign a branch to your account in Team.</Alert>}
    </section>;
  }

  if (section === 'reports') {
    const currency = dashboard?.currency || 'LKR';
    const money = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
    const metrics: Array<[string, string]> = [
      ['Gross sales today', dashboard ? money(dashboard.grossSalesToday) : 'Unavailable'],
      ['Completed sales today', dashboard ? String(dashboard.salesToday) : 'Unavailable'],
      ['Units sold today', dashboard ? String(dashboard.itemsSoldToday) : 'Unavailable'],
      ['Active products', dashboard ? String(dashboard.activeProducts) : 'Unavailable'],
      ['Low-stock products', dashboard ? String(dashboard.lowStockProducts) : 'Unavailable'],
      ['Pending product reviews', dashboard ? String(dashboard.pendingDraftReviews) : 'Unavailable'],
    ];
    const branchQuery = branchId ? `?branch=${encodeURIComponent(branchId)}` : '';
    return <section aria-labelledby="retail-module-title" className="min-w-0 space-y-5">
      <div><p className="eyebrow mb-2">Retail &amp; E-Commerce operations</p><h2 id="retail-module-title" className="text-2xl font-semibold tracking-tight text-brand-navy">Branch report</h2><p className="mt-2 text-sm text-slate-600">Live totals for the selected branch, using recorded sales and current inventory.</p></div>
      {dashboard ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value]) => <div key={label} className="min-w-0 border border-brand-line bg-white p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-4 break-words text-xl font-semibold text-brand-navy">{value}</p></div>)}</div> : <Alert variant="warning" title="Report data unavailable">Select an assigned branch and confirm retail data has loaded. No sample figures are shown.</Alert>}
      <div className="border border-brand-line bg-white p-4"><h3 className="font-medium text-brand-navy">Current stock snapshot</h3><p className="mt-1 text-sm text-slate-600">{dashboard ? `${products.length} active catalogue products are loaded for this branch.` : 'Stock totals are unavailable until branch data loads.'}</p><Button asChild className="mt-4" variant="outline"><Link href={`/w/${encodeURIComponent(organizationSlug)}/retail${branchQuery}`}>Open inventory</Link></Button></div>
    </section>;
  }

  if (section === 'controls') {
    return <section aria-labelledby="retail-module-title" className="min-w-0 space-y-5">
      <div><p className="eyebrow mb-2">Retail &amp; E-Commerce operations</p><h2 id="retail-module-title" className="text-2xl font-semibold tracking-tight text-brand-navy">Business controls</h2><p className="mt-2 text-sm text-slate-600">Manage access using the existing workspace settings and Team screens.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-brand-line bg-white p-4"><h3 className="font-medium text-brand-navy">Team access</h3><p className="mt-2 text-sm text-slate-600">Review member roles, invitations and branch assignments.</p><Button asChild className="mt-4" variant="outline"><Link href={`/w/${encodeURIComponent(organizationSlug)}/settings/team`}>Open Team</Link></Button></div>
        <div className="border border-brand-line bg-white p-4"><h3 className="font-medium text-brand-navy">Business settings</h3><p className="mt-2 text-sm text-slate-600">Review the workspace business configuration.</p><Button asChild className="mt-4" variant="outline"><Link href={`/w/${encodeURIComponent(organizationSlug)}/settings`}>Open settings</Link></Button></div>
      </div>
      <Alert variant="info" title="Till and audit controls are not available">Till reconciliation and a Retail audit activity screen are not part of the current data/actions. No control status is inferred.</Alert>
    </section>;
  }

  return <section aria-labelledby="retail-module-title" className="min-w-0 space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow mb-2">Retail &amp; E-Commerce operations</p>
        <h2 id="retail-module-title" className="break-words text-2xl font-semibold tracking-tight text-brand-navy">{definition.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{definition.description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {definition.secondaryAction && <Button type="button" variant="outline" disabled aria-describedby={statusId}>{definition.secondaryAction}</Button>}
        <Button type="button" disabled aria-describedby={statusId}>{definition.action}</Button>
      </div>
    </div>
    <Alert id={statusId} role="status" variant="info" title="Not connected yet">This module is visible for review, but its records and actions are not connected in this Preview.</Alert>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {definition.metrics.map((label) => <div key={label} className="min-w-0 border border-brand-line bg-white p-4">
        <p className="text-sm text-slate-600">{label}</p>
        <p className="mt-4 text-xl font-semibold text-brand-navy">Unavailable</p>
        <p className="mt-2 text-xs text-slate-500">Awaiting connected data</p>
      </div>)}
    </div>
    <div className="max-w-full overflow-x-auto border border-brand-line bg-white">
      <div className="border-b border-brand-line p-4">
        <label className="block max-w-md space-y-1 text-sm text-slate-600">
          <span className="sr-only">{definition.search}</span>
          <input type="search" placeholder={definition.search} disabled aria-describedby={statusId} className="min-h-11 w-full min-w-0 border border-brand-line bg-slate-50 px-3 text-sm text-slate-600" />
        </label>
      </div>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600"><tr>{definition.columns.map((column) => <th key={column} scope="col" className="px-4 py-3 font-medium">{column}</th>)}</tr></thead>
        <tbody><tr><td colSpan={definition.columns.length} className="px-4 py-9 text-center text-sm leading-6 text-slate-600">{definition.detail}</td></tr></tbody>
      </table>
    </div>
  </section>;
}
