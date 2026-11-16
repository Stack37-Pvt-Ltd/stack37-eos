'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';
import { ProductDraftReview } from './product-draft-review';
import { isRetailModuleSection, RetailModulePanel, RetailModuleTabs, type RetailModuleSection } from './retail-module-sections';
import { adjustInventoryAction, recordRetailSaleAction } from '../../lib/actions/retail';

type Branch = { id: string; name: string };
type Product = { id: string; name: string; sku: string; barcode: string | null; selling_price: number; quantity: number };
type Dashboard = { salesToday: number; grossSalesToday: number; itemsSoldToday: number; activeProducts: number; lowStockProducts: number; pendingDraftReviews: number; currency: string };
type RetailView = 'overview' | 'pos' | 'inventory' | 'drafts' | RetailModuleSection;

const coreRetailSections = [
  { id: 'overview', label: 'Overview' },
  { id: 'pos', label: 'Point of sale' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'drafts', label: 'Product drafts' },
] as const;

export function RetailLiveWorkspace({ organizationId, organizationSlug, organizationName, branchId, branches, products, dashboard, inventoryPermission, salesPermission, loadError }: {
  organizationId: string; organizationSlug: string; organizationName: string; branchId: string | null; branches: Branch[];
  products: Product[]; dashboard: Dashboard | null; inventoryPermission: boolean; salesPermission: boolean; loadError?: string;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<RetailView>('overview');
  const [search, setSearch] = React.useState('');
  const [basket, setBasket] = React.useState<Record<string, number>>({});
  const [payment, setPayment] = React.useState<'cash' | 'external_card'>('cash');
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [adjustTarget, setAdjustTarget] = React.useState<Product | null>(null);
  const [adjustment, setAdjustment] = React.useState('');
  const [reason, setReason] = React.useState('');
  const currency = dashboard?.currency || 'LKR';
  const formatter = React.useMemo(() => new Intl.NumberFormat('en-GB', { style: 'currency', currency }), [currency]);
  const lines = products.filter((product) => (basket[product.id] || 0) > 0).map((product) => ({ product, quantity: basket[product.id] }));
  const total = lines.reduce((sum, line) => sum + Number(line.product.selling_price) * line.quantity, 0);
  const filtered = products.filter((product) => `${product.name} ${product.sku} ${product.barcode || ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function checkout() {
    if (!branchId || !lines.length || busy) return;
    setBusy(true); setNotice(null);
    try {
      const result = await recordRetailSaleAction({ organizationId, branchId, idempotencyKey: crypto.randomUUID(), paymentMethod: payment, lines: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })) });
      if (!result.success || !result.data) { setNotice({ kind: 'error', message: result.error || 'Checkout could not be completed.' }); return; }
      setBasket({}); setNotice({ kind: 'success', message: `Sale recorded. Receipt ${result.data.receiptNumber} · ${formatter.format(result.data.total)}${payment === 'external_card' ? ' · Card payment was processed outside STACK37.' : ''}` });
      router.refresh();
    } catch { setNotice({ kind: 'error', message: 'Checkout could not be completed. Refresh the page and try again.' }); }
    finally { setBusy(false); }
  }

  async function saveAdjustment(event: React.FormEvent) {
    event.preventDefault(); if (!branchId || !adjustTarget || busy) return;
    setBusy(true); setNotice(null);
    try {
      const result = await adjustInventoryAction({ organizationId, branchId, productId: adjustTarget.id, quantityDelta: Number(adjustment), reason });
      if (!result.success) { setNotice({ kind: 'error', message: result.error || 'Stock adjustment could not be saved.' }); return; }
      setAdjustTarget(null); setAdjustment(''); setReason(''); setNotice({ kind: 'success', message: `Stock updated. New balance: ${result.data?.quantity ?? 'saved'}.` }); router.refresh();
    } catch { setNotice({ kind: 'error', message: 'Stock adjustment could not be saved.' }); }
    finally { setBusy(false); }
  }

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-col gap-4 border-b border-brand-line pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow mb-2">Retail &amp; E-Commerce</p><h1 className="text-3xl font-semibold tracking-tight text-brand-navy">Store operations</h1><p className="mt-2 text-sm text-slate-600">{organizationName} · branch stock and sales</p></div>
      <label className="block space-y-1 text-xs font-medium text-slate-600">Operating branch<select aria-label="Operating branch" value={branchId || ''} onChange={(event) => router.push(`/w/${encodeURIComponent(organizationSlug)}/retail?branch=${encodeURIComponent(event.target.value)}`)} className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm text-brand-navy sm:min-w-56">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
    </header>
    <div role="group" aria-label="Retail sections" className="max-w-full overflow-x-auto border-b border-brand-line pb-3">
      <div className="flex w-max min-w-full flex-nowrap gap-2">
        {coreRetailSections.map(({ id, label }) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`min-h-10 shrink-0 border px-3 text-sm ${view === id ? 'border-brand-blue bg-blue-50 font-semibold text-brand-navy' : 'border-brand-line bg-white text-slate-600'}`}>{label}</button>)}
        <RetailModuleTabs selected={view} onSelect={setView} />
      </div>
    </div>
    {notice && <Alert variant={notice.kind} title={notice.kind === 'success' ? 'Saved' : 'Needs attention'}>{notice.message}</Alert>}
    {loadError && <Alert variant="warning" title="Retail data unavailable">{loadError} Check that the reviewed retail migration has been applied to this environment. No sample totals are shown.</Alert>}
    {!branchId && <Alert variant="info" title="No assigned branch">This account is not assigned to a retail branch. Ask a workspace administrator to assign a branch.</Alert>}
    {view === 'overview' && <section className="space-y-5"><div><h2 className="text-xl font-semibold text-brand-navy">Today at this branch</h2><p className="mt-1 text-sm text-slate-600">Live totals based on recorded sales and current stock.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Gross sales today', dashboard ? formatter.format(dashboard.grossSalesToday) : 'Unavailable'], ['Completed sales', dashboard?.salesToday ?? 'Unavailable'], ['Units sold', dashboard?.itemsSoldToday ?? 'Unavailable'], ['Low stock products', dashboard?.lowStockProducts ?? 'Unavailable']].map(([label, value]) => <div key={label} className="border border-brand-line bg-white p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-4 text-2xl font-semibold text-brand-navy">{value}</p></div>)}</div>
      <div className="grid gap-3 sm:grid-cols-3">{[['Start checkout', 'Search the product catalogue and record a sale.', 'pos'], ['Review stock', 'View on-hand quantities and record stock counts.', 'inventory'], ['Review imported products', 'Approve product drafts before they enter the catalogue.', 'drafts']].map(([title, detail, section]) => <button key={section} type="button" onClick={() => setView(section as typeof view)} className="border border-brand-line bg-white p-4 text-left hover:bg-slate-50"><strong className="text-brand-navy">{title}</strong><p className="mt-2 text-sm leading-5 text-slate-600">{detail}</p></button>)}</div>
    </section>}
    {view === 'pos' && <section className="space-y-4"><div><h2 className="text-xl font-semibold text-brand-navy">Point of sale</h2><p className="mt-1 text-sm text-slate-600">Sales use the catalogue price and reduce this branch’s stock atomically.</p></div><Alert variant="info" title="Payment handling">Cash sales are recorded here. Card selection records an externally processed payment only; STACK37 does not charge a card or contact a payment terminal. Tax is not calculated by this release.</Alert>
      {!salesPermission && <Alert variant="warning">Your role does not have checkout permission. An administrator can assign the Cashier role.</Alert>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"><div className="space-y-3"><input type="search" aria-label="Search products or barcode" placeholder="Search name, SKU or barcode" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 w-full border border-slate-300 px-3 text-sm"/><div className="max-h-[55vh] overflow-auto border border-brand-line">{filtered.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-brand-line p-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-brand-navy">{product.name}</p><p className="text-xs text-slate-500">{product.sku} · {product.quantity} in stock</p></div><div className="flex items-center gap-3"><span className="text-sm">{formatter.format(Number(product.selling_price))}</span><Button size="sm" disabled={!salesPermission || product.quantity <= 0} onClick={() => setBasket((current) => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }))}>Add</Button></div></div>)}{!filtered.length && <p className="p-5 text-sm text-slate-500">No matching products in this branch.</p>}</div></div>
        <aside className="space-y-4 border border-brand-line p-4"><h3 className="font-semibold text-brand-navy">Current sale</h3>{lines.length ? lines.map(({ product, quantity }) => <div key={product.id} className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate">{product.name} × {quantity}</span><span>{formatter.format(Number(product.selling_price) * quantity)}</span></div>) : <p className="text-sm text-slate-500">Add products to start a sale.</p>}<label className="block space-y-1 text-xs font-medium text-slate-600">Payment method<select value={payment} onChange={(event) => setPayment(event.target.value as typeof payment)} className="min-h-10 w-full border border-slate-300 bg-white px-2 text-sm"><option value="cash">Cash</option><option value="external_card">Card processed externally</option></select></label><div className="flex justify-between border-t border-brand-line pt-3 font-semibold"><span>Total before tax</span><span>{formatter.format(total)}</span></div><Button className="w-full" disabled={!salesPermission || !lines.length || busy} isLoading={busy} onClick={checkout}>Record sale</Button></aside></div></section>}
    {view === 'inventory' && <section className="space-y-4"><div><h2 className="text-xl font-semibold text-brand-navy">Branch inventory</h2><p className="mt-1 text-sm text-slate-600">Stock quantities are branch specific. New imported products start at zero until counted.</p></div>{!inventoryPermission && <Alert variant="warning">Your role can view stock but cannot change it. An administrator can grant inventory access.</Alert>}<div className="overflow-x-auto border border-brand-line"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">On hand</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{products.map((product) => <tr key={product.id} className="border-t border-brand-line"><td className="px-4 py-3">{product.name}</td><td className="px-4 py-3">{product.sku}</td><td className="px-4 py-3">{product.quantity}</td><td className="px-4 py-3">{formatter.format(Number(product.selling_price))}</td><td className="px-4 py-3"><Button variant="outline" size="sm" disabled={!inventoryPermission} onClick={() => { setAdjustTarget(product); setAdjustment(''); setReason(''); }}>Adjust stock</Button></td></tr>)}</tbody></table>{!products.length && <p className="p-5 text-sm text-slate-500">No active products are available.</p>}</div></section>}
    {view === 'drafts' && <ProductDraftReview organizationId={organizationId} organizationName={organizationName} />}
    {isRetailModuleSection(view) ? <RetailModulePanel section={view} organizationSlug={organizationSlug} branches={branches} branchId={branchId} products={products} dashboard={dashboard} /> : null}
    {adjustTarget && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4"><section role="dialog" aria-modal="true" aria-labelledby="stock-adjust-title" className="w-full max-w-md space-y-4 border border-slate-300 bg-white p-5"><h2 id="stock-adjust-title" className="text-xl font-semibold text-brand-navy">Adjust stock</h2><p className="text-sm text-slate-600">{adjustTarget.name} · current balance {adjustTarget.quantity}</p><form className="space-y-4" onSubmit={saveAdjustment}><label className="block space-y-1 text-sm">Quantity change<input required type="number" step="0.001" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} className="min-h-11 w-full border border-slate-300 px-3" placeholder="Use a negative number to reduce stock"/></label><label className="block space-y-1 text-sm">Reason<input required minLength={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-11 w-full border border-slate-300 px-3"/></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAdjustTarget(null)}>Cancel</Button><Button type="submit" isLoading={busy}>Save adjustment</Button></div></form></section></div>}
  </div>;
}
