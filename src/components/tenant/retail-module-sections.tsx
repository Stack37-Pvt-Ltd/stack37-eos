'use client';

import Link from 'next/link';
import {
  BarChart3,
  ShieldCheck,
  Store,
  Tag,
  Truck,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';

export const retailModuleSections = [
  { id: 'purchasing', label: 'Purchasing', icon: Truck },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'employees', label: 'Employees', icon: UserRound },
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
  employees: {
    title: 'Employees', description: 'Review team members, roles and operating locations.',
    action: 'Add employee', search: 'Search team members',
    metrics: ['Team members', 'Cashiers', 'Locations'], columns: ['Employee', 'Role', 'Location', 'Status'],
    detail: 'Staff profiles and assignments are managed in Team.',
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

export function RetailModulePanel({ section, organizationSlug }: {
  section: RetailModuleSection;
  organizationSlug: string;
}) {
  const definition = moduleDefinitions[section];
  const statusId = `retail-module-status-${section}`;

  if (section === 'employees') {
    return <section aria-labelledby="retail-module-title" className="min-w-0 space-y-5">
      <div>
        <p className="eyebrow mb-2">Retail &amp; E-Commerce operations</p>
        <h2 id="retail-module-title" className="text-2xl font-semibold tracking-tight text-brand-navy">{definition.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{definition.description}</p>
      </div>
      <Alert variant="info" title="Employee management is in Team">
        View the employee roster, roles and branch assignments in Team. Changes are disabled in this Preview to protect shared live records.
      </Alert>
      <Button asChild variant="outline"><Link href={`/w/${encodeURIComponent(organizationSlug)}/settings/team`}>Open Team</Link></Button>
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
