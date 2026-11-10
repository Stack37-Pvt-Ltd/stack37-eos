'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, Banknote, Boxes, CreditCard, LayoutDashboard, LockKeyhole,
  ReceiptText, Search, ShieldCheck, ShoppingCart, Store, Tag, Truck, UserRound, Users, Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/button';
import { ProductDraftReview } from './product-draft-review';
import { RetailInventoryCatalog } from './retail-operations-ui';

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'pos', label: 'Point of sale', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'purchasing', label: 'Purchasing', icon: Truck },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'employees', label: 'Employees', icon: UserRound },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'branches', label: 'Branches', icon: Store },
  { id: 'promotions', label: 'Loyalty & offers', icon: Tag },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'controls', label: 'Controls', icon: ShieldCheck },
] as const;

export type RetailSection = (typeof sections)[number]['id'];
type RecordSection = Exclude<RetailSection, 'overview' | 'pos' | 'inventory'>;

type DemoProduct = { id: string; name: string; barcode: string; price: number };
type DemoPaymentMethod = 'cash' | 'card';

const DEMO_PRODUCTS: DemoProduct[] = [
  { id: 'demo-chocolate', name: 'Chocolate Snack Box', barcode: 'DEMO-0001', price: 680 },
  { id: 'demo-drink', name: 'Sparkling Lime Drink · 330 ml', barcode: 'DEMO-0002', price: 420 },
  { id: 'demo-notebook', name: 'Everyday Notebook · A5', barcode: 'DEMO-0003', price: 950 },
  { id: 'demo-tote', name: 'Reusable Tote Bag', barcode: 'DEMO-0004', price: 1200 },
];

interface ModuleDefinition {
  title: string;
  description: string;
  action: string;
  secondaryAction?: string;
  search: string;
  metrics: [string, string, string];
  columns: [string, string, string, string];
  detail: string;
}

const modules: Record<RecordSection, ModuleDefinition> = {
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
    detail: 'Staff profiles and assignments will appear when employee management is connected.',
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

export function RetailOperationsWorkspace({ organizationId, organizationSlug, organizationName, currencyCode, initialSection = 'overview' }: {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  currencyCode: string;
  initialSection?: RetailSection;
}) {
  const [selected, setSelected] = useState<RetailSection>(initialSection);
  return (
    <div className="min-w-0 space-y-7">
      <header className="flex flex-col gap-4 border-b border-brand-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Retail &amp; E-Commerce</p>
          <h1 className="break-words text-3xl font-semibold tracking-[-0.045em] text-brand-navy">Retail & E-Commerce operations</h1>
          <p className="mt-2 break-words text-sm text-slate-600">{organizationName} · Your store workspace</p>
        </div>
        <span className="inline-flex min-h-10 items-center gap-2 self-start border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
          <LockKeyhole aria-hidden="true" className="h-4 w-4 shrink-0" /> Limited operations
        </span>
      </header>

      <p id="retail-connection-note" role="status" className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        Live sales, stock balances and other operational data are not connected yet.
      </p>

      <nav aria-label="Retail & E-Commerce sections" className="max-w-full border-b border-brand-line">
        <div className="flex flex-wrap gap-2 py-2">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setSelected(id)} aria-current={selected === id ? 'page' : undefined}
              className={`inline-flex min-h-10 min-w-0 items-center gap-2 rounded-md border px-3 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${selected === id ? 'border-brand-blue bg-blue-50 font-semibold text-brand-navy' : 'border-brand-line bg-white text-slate-600 hover:bg-slate-50'}`}>
              <Icon aria-hidden="true" className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </nav>

      {selected === 'overview' ? <Overview onSelect={setSelected} />
        : selected === 'pos' ? <PointOfSale />
          : selected === 'inventory' ? organizationSlug === 'uk-super' ? (
            <section aria-label="UK Super inventory" className="space-y-4">
              <p role="status" className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                Product drafts are available for review below, but live inventory is not connected. The imported products have no stock quantities or stock movement records, so this page cannot show stock on hand.
              </p>
              <ProductDraftReview organizationId={organizationId} organizationName={organizationName} />
            </section>
          ) : <RetailInventoryCatalog embedded state="unavailable" currencyCode={currencyCode} />
            : <ModulePanel definition={modules[selected]} />}
    </div>
  );
}

function Overview({ onSelect }: { onSelect: (section: RetailSection) => void }) {
  const shortcuts: Array<{ label: string; detail: string; section: RetailSection; icon: LucideIcon }> = [
    { label: 'Point of sale', detail: 'Scan products and prepare a sale', section: 'pos', icon: ShoppingCart },
    { label: 'Product & stock', detail: 'Find SKUs and inventory by location', section: 'inventory', icon: Boxes },
    { label: 'Purchasing', detail: 'Review suppliers and orders', section: 'purchasing', icon: Truck },
    { label: 'Reports', detail: 'Review store performance', section: 'reports', icon: BarChart3 },
  ];
  return (
    <section aria-labelledby="retail-overview-title" className="space-y-7">
      <div><p className="eyebrow mb-2">Operations overview</p><h2 id="retail-overview-title" className="text-2xl font-semibold tracking-tight">Your business at a glance</h2><p className="mt-2 text-sm text-slate-600">See sales, stock and daily activity across your locations.</p></div>
      <MetricGrid labels={['Sales today', 'Transactions', 'Active SKUs', 'Low-stock items']} />
      <div><div className="mb-4"><h3 className="text-lg font-semibold">Go to a workspace</h3><p className="mt-1 text-sm text-slate-600">Explore the tools for your store.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map(({ label, detail, section, icon: Icon }) => <button type="button" key={section} onClick={() => onSelect(section)} className="group flex min-h-32 min-w-0 flex-col items-start border border-brand-line bg-white p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"><Icon aria-hidden="true" className="mb-4 h-5 w-5 text-brand-blue" /><span className="flex w-full items-center justify-between gap-2 font-semibold text-brand-navy">{label}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></span><span className="mt-1 text-xs leading-5 text-slate-600">{detail}</span></button>)}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2"><UnavailableBlock title="Items to replenish" detail="Low-stock items will appear when inventory is connected." /><UnavailableBlock title="Recent activity" detail="Stock movements and sales will appear when operations are connected." /></div>
    </section>
  );
}

function MetricGrid({ labels }: { labels: readonly string[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{labels.map((label) => <div key={label} className="min-w-0 border border-brand-line bg-white p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-4 text-xl font-semibold text-brand-navy">Unavailable</p><p className="mt-2 text-xs text-slate-500">Awaiting connected data</p></div>)}</div>;
}

function UnavailableBlock({ title, detail }: { title: string; detail: string }) {
  return <section className="min-w-0 border-t border-brand-line pt-5"><h3 className="font-semibold text-brand-navy">{title}</h3><p className="mt-3 border border-brand-line bg-slate-50 p-4 text-sm leading-6 text-slate-600">{detail}</p></section>;
}

function PointOfSale() {
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<DemoPaymentMethod | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const cartLines = useMemo(
    () => DEMO_PRODUCTS.flatMap((product) => {
      const quantity = quantities[product.id] ?? 0;
      return quantity > 0 ? [{ ...product, quantity, lineTotal: product.price * quantity }] : [];
    }),
    [quantities]
  );
  const subtotal = cartLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const matchingProducts = DEMO_PRODUCTS.filter((product) =>
    !normalizedSearch ||
    product.name.toLocaleLowerCase().includes(normalizedSearch) ||
    product.barcode.toLocaleLowerCase() === normalizedSearch
  );

  function addProduct(productId: string) {
    setQuantities((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
    setShowReceipt(false);
  }

  function changeQuantity(productId: string, delta: number) {
    setQuantities((current) => {
      const nextQuantity = (current[productId] ?? 0) + delta;
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: nextQuantity };
    });
    setShowReceipt(false);
  }

  function startNewDemoSale() {
    setQuantities({});
    setPaymentMethod(null);
    setSearch('');
    setShowReceipt(false);
  }

  return (
    <section aria-labelledby="pos-title" className="space-y-6">
      <div>
        <p className="eyebrow mb-2">Checkout prototype</p>
        <h2 id="pos-title" className="text-2xl font-semibold tracking-tight">Point of sale</h2>
        <p className="mt-2 text-sm text-slate-600">Try sample product lookup, a basket, and a receipt preview.</p>
      </div>

      <p role="status" className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        Demo only: these sample products stay in this page. No payment is taken, no sale is saved, and no stock is changed.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="min-w-0 space-y-5 border border-brand-line p-4 sm:p-5">
          <div className="space-y-3">
            <label htmlFor="pos-search" className="block text-sm font-medium text-brand-navy">Product name or sample barcode</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input id="pos-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Try Chocolate or DEMO-0001" className="min-h-11 w-full min-w-0 border border-brand-line bg-white py-2 pl-10 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue" />
            </div>
            <ul aria-label="Sample products" className="divide-y divide-brand-line border border-brand-line">
              {matchingProducts.length === 0 ? <li className="px-3 py-4 text-sm text-slate-600">No sample product matches that search.</li>
                : matchingProducts.map((product) => (
                  <li key={product.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0"><p className="break-words text-sm font-medium text-brand-navy">{product.name}</p><p className="mt-1 break-all font-mono text-xs text-slate-500">{product.barcode}</p></div>
                    <div className="flex shrink-0 items-center gap-3"><span className="text-sm font-medium">{formatLkr(product.price)}</span><Button type="button" size="sm" variant="outline" onClick={() => addProduct(product.id)}>Add</Button></div>
                  </li>
                ))}
            </ul>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line pb-3">
              <h3 className="font-semibold">Current sale</h3>
              <Button type="button" variant="outline" disabled={cartLines.length === 0} onClick={startNewDemoSale}>Clear sale</Button>
            </div>
            {cartLines.length === 0 ? <div className="border border-dashed border-brand-line bg-slate-50 px-4 py-8 text-center"><ReceiptText aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-3 text-sm font-medium text-brand-navy">No items yet</p><p className="mt-1 text-xs leading-5 text-slate-600">Add a sample product to see how the basket works.</p></div>
              : <ul aria-label="Current sample basket" className="divide-y divide-brand-line border border-brand-line">
                {cartLines.map((line) => (
                  <li key={line.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0"><p className="break-words text-sm font-medium text-brand-navy">{line.name}</p><p className="mt-1 text-xs text-slate-600">{formatLkr(line.price)} each</p></div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button type="button" size="sm" variant="outline" aria-label={`Remove one ${line.name}`} onClick={() => changeQuantity(line.id, -1)}>−</Button>
                      <span aria-label={`Quantity ${line.quantity}`} className="min-w-6 text-center text-sm font-medium">{line.quantity}</span>
                      <Button type="button" size="sm" variant="outline" aria-label={`Add one ${line.name}`} onClick={() => changeQuantity(line.id, 1)}>+</Button>
                      <span className="ml-1 min-w-20 text-right text-sm font-medium">{formatLkr(line.lineTotal)}</span>
                    </div>
                  </li>
                ))}
              </ul>}
          </div>
        </div>

        <aside aria-label={showReceipt ? 'Sample receipt preview' : 'Sample checkout summary'} className="min-w-0 space-y-5 border border-brand-line p-4 sm:p-5">
          {showReceipt ? <>
            <div className="flex items-start gap-3"><ReceiptText aria-hidden="true" className="mt-0.5 h-5 w-5 text-brand-blue" /><div><h3 className="font-semibold">Receipt preview</h3><p className="mt-1 text-xs text-slate-600">Sample only · not recorded</p></div></div>
            <div className="border-y border-dashed border-brand-line py-4">
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-500">UK Super · Demo receipt</p>
              <p className="mt-2 text-center font-mono text-xs text-slate-500">SAMPLE-0001</p>
              <ul className="mt-4 space-y-2 text-sm">{cartLines.map((line) => <li key={line.id} className="flex justify-between gap-3"><span className="min-w-0 break-words">{line.quantity} × {line.name}</span><span className="shrink-0">{formatLkr(line.lineTotal)}</span></li>)}</ul>
              <div className="mt-4 flex justify-between gap-3 border-t border-brand-line pt-3 text-sm font-semibold"><span>Sample subtotal</span><span>{formatLkr(subtotal)}</span></div>
              <p className="mt-2 text-xs leading-5 text-slate-600">Taxes and discounts are not calculated in this prototype.</p>
              <p className="mt-3 text-center text-xs text-slate-500">Payment selection: {paymentMethod === 'cash' ? 'Cash (sample)' : 'Card (sample)'}</p>
            </div>
            <p role="status" className="text-sm leading-6 text-emerald-800">Demo complete. No payment was taken and this receipt was not saved.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1"><Button type="button" variant="outline" disabled aria-describedby="pos-hardware-note"><ReceiptText aria-hidden="true" className="h-4 w-4" /> Print receipt</Button><Button type="button" variant="outline" disabled aria-describedby="pos-hardware-note"><Banknote aria-hidden="true" className="h-4 w-4" /> Open cash drawer</Button></div>
            <p id="pos-hardware-note" className="text-xs leading-5 text-slate-500">Receipt printing and cash drawer hardware are not connected.</p>
            <Button type="button" className="w-full" onClick={startNewDemoSale}>Start another demo sale</Button>
          </> : <>
            <div><h3 className="font-semibold">Checkout summary</h3><p className="mt-1 text-xs text-slate-600">Sample totals only; no tax or discount calculation.</p></div>
            <dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-600">Items</dt><dd className="font-medium text-brand-navy">{cartLines.reduce((count, line) => count + line.quantity, 0)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-600">Sample subtotal</dt><dd className="font-semibold text-brand-navy">{formatLkr(subtotal)}</dd></div></dl>
            <div><p className="mb-2 text-sm font-medium">Demo payment selection</p><div className="grid grid-cols-2 gap-2"><Button type="button" variant={paymentMethod === 'cash' ? 'primary' : 'outline'} aria-pressed={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')}><Banknote aria-hidden="true" className="h-4 w-4" /> Cash</Button><Button type="button" variant={paymentMethod === 'card' ? 'primary' : 'outline'} aria-pressed={paymentMethod === 'card'} onClick={() => setPaymentMethod('card')}><CreditCard aria-hidden="true" className="h-4 w-4" /> Card</Button></div></div>
            <Button type="button" className="w-full" disabled={cartLines.length === 0 || paymentMethod === null} onClick={() => setShowReceipt(true)}>Show demo receipt</Button>
            <p className="text-xs leading-5 text-slate-500">This only changes what you see here. It does not contact a payment service or save a sale.</p>
          </>}
        </aside>
      </div>
    </section>
  );
}

function formatLkr(value: number) {
  return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(value);
}

function ModulePanel({ definition }: { definition: ModuleDefinition }) {
  return (
    <section aria-labelledby="module-title" className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="eyebrow mb-2">Retail & E-Commerce operations</p><h2 id="module-title" className="break-words text-2xl font-semibold tracking-tight">{definition.title}</h2><p className="mt-2 text-sm text-slate-600">{definition.description}</p></div><div className="flex flex-wrap gap-2">{definition.secondaryAction && <Button type="button" variant="outline" disabled aria-describedby="retail-connection-note">{definition.secondaryAction}</Button>}<Button type="button" disabled aria-describedby="retail-connection-note">{definition.action}</Button></div></div>
      <MetricGrid labels={definition.metrics} />
      <div className="border border-brand-line bg-white"><div className="border-b border-brand-line p-4"><label className="relative block max-w-md"><span className="sr-only">{definition.search}</span><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input type="search" placeholder={definition.search} disabled aria-describedby="retail-connection-note" className="min-h-11 w-full min-w-0 border border-brand-line bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-600" /></label></div><div className="max-w-full overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{definition.columns.map((column) => <th key={column} scope="col" className="px-4 py-3 font-medium">{column}</th>)}</tr></thead><tbody><tr><td colSpan={definition.columns.length} className="px-4 py-9 text-center text-sm leading-6 text-slate-600">{definition.detail}</td></tr></tbody></table></div></div>
    </section>
  );
}
