'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Box, CircleDollarSign, PackageCheck, Search, Store } from 'lucide-react';
import { Button } from '../ui/button';

export type RetailViewState = 'loading' | 'ready' | 'empty' | 'error' | 'unavailable';

export type RetailItemType = 'packaged' | 'weighted' | 'perishable' | 'service';

export interface RetailInventoryItem {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  itemType: RetailItemType;
  unit: string;
  sellingPrice: number;
  quantityOnHand: number;
  reorderLevel: number | null;
  branchName: string;
  expiryDate: string | null;
}

export interface RetailDashboardData {
  currencyCode: string;
  todaySales: number | null;
  salesChangePercent: number | null;
  transactionCount: number | null;
  activeSkuCount: number;
  lowStockCount: number;
  branchCount: number;
  lowStockItems: Array<Pick<RetailInventoryItem, 'id' | 'name' | 'sku' | 'quantityOnHand' | 'unit' | 'branchName'>>;
  recentMovements: Array<{ id: string; label: string; detail: string; occurredAt: string }>;
}

const itemTypeLabels: Record<RetailItemType, string> = {
  packaged: 'Packaged',
  weighted: 'Variable weight',
  perishable: 'Perishable',
  service: 'Non-stock / service',
};

function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat(currencyCode === 'LKR' ? 'en-LK' : 'en-GB', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amount);
}

function StatePanel({ state, label }: { state: Exclude<RetailViewState, 'ready'>; label: string }) {
  const stateText = {
    loading: 'Loading live workspace data…',
    empty: `No ${label.toLowerCase()} have been recorded yet.`,
    error: `We could not load ${label.toLowerCase()}. Try again or contact your administrator.`,
    unavailable: `${label} is not connected to live workspace data yet. No sample figures are shown here.`,
  }[state];
  const isError = state === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-busy={state === 'loading' || undefined}
      className={`border p-4 text-sm ${isError ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-brand-line bg-slate-50 text-slate-700'}`}
    >
      <p className="font-medium">{state === 'loading' ? `Loading ${label.toLowerCase()}` : state === 'empty' ? `No ${label.toLowerCase()} yet` : state === 'error' ? `${label} unavailable` : `${label} not connected`}</p>
      <p className="mt-1 leading-6">{stateText}</p>
    </div>
  );
}

export function RetailAdminDashboard({
  organizationName,
  state,
  data,
}: {
  organizationName: string;
  state: RetailViewState;
  data?: RetailDashboardData;
}) {
  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="eyebrow mb-3">Operations overview</p>
          <h1 className="break-words text-3xl font-semibold tracking-[-0.045em]">{organizationName}</h1>
          <p className="mt-2 text-sm text-slate-600">Today’s retail activity across your authorized locations.</p>
        </div>
        <div className="inline-flex min-h-10 items-center gap-2 border border-brand-line bg-white px-3 text-xs text-slate-600">
          <Store aria-hidden="true" className="h-4 w-4 text-brand-blue" />
          <span>{data ? `${data.branchCount} locations` : 'Locations'}</span>
        </div>
      </header>

      {state !== 'ready' || !data ? (
        <StatePanel state={state === 'ready' ? 'unavailable' : state} label="Dashboard data" />
      ) : (
        <>
          <section aria-label="Key business metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Sales today" value={data.todaySales === null ? 'Unavailable' : formatCurrency(data.todaySales, data.currencyCode)} icon={<CircleDollarSign aria-hidden="true" />} detail={data.todaySales === null ? 'Sales data is not connected yet' : data.salesChangePercent === null ? 'Comparison unavailable' : `${data.salesChangePercent >= 0 ? '+' : ''}${data.salesChangePercent}% vs previous day`} trend={data.salesChangePercent} />
            <Metric label="Transactions" value={data.transactionCount === null ? 'Unavailable' : data.transactionCount.toLocaleString()} icon={<ArrowUpRight aria-hidden="true" />} detail={data.transactionCount === null ? 'POS data is not connected yet' : 'Completed today'} />
            <Metric label="Active SKUs" value={data.activeSkuCount.toLocaleString()} icon={<Box aria-hidden="true" />} detail="Across all locations" />
            <Metric label="Low stock" value={data.lowStockCount.toLocaleString()} icon={<AlertTriangle aria-hidden="true" />} detail="Items at or below reorder level" warning={data.lowStockCount > 0} />
          </section>

          <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="min-w-0 border-t border-brand-line pt-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Items to replenish</h2>
                  <p className="mt-1 text-sm text-slate-600">Stock at or below its configured reorder level.</p>
                </div>
                <PackageCheck aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-brand-blue" />
              </div>
              {data.lowStockItems.length === 0 ? (
                <p className="border border-brand-line bg-slate-50 p-4 text-sm text-slate-600">No items are currently below their reorder level.</p>
              ) : (
                <div className="overflow-x-auto border border-brand-line">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">SKU</th><th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 text-right font-medium">On hand</th></tr></thead>
                    <tbody>{data.lowStockItems.map((item) => <tr key={item.id} className="border-t border-brand-line"><td className="px-4 py-3 font-medium text-slate-900">{item.name}</td><td className="px-4 py-3 font-mono text-xs text-slate-600">{item.sku}</td><td className="px-4 py-3 text-slate-600">{item.branchName}</td><td className="px-4 py-3 text-right tabular-nums">{item.quantityOnHand} {item.unit}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="min-w-0 border-t border-brand-line pt-5">
              <h2 className="text-lg font-semibold tracking-tight">Recent stock activity</h2>
              <p className="mt-1 text-sm text-slate-600">Receipts, adjustments and transfers.</p>
              {data.recentMovements.length === 0 ? (
                <p className="mt-4 border border-brand-line bg-slate-50 p-4 text-sm text-slate-600">No stock activity has been recorded.</p>
              ) : (
                <ol className="mt-4 divide-y divide-brand-line border-y border-brand-line">
                  {data.recentMovements.map((movement) => <li key={movement.id} className="py-4"><p className="text-sm font-medium text-slate-900">{movement.label}</p><p className="mt-1 text-xs leading-5 text-slate-600">{movement.detail}</p><time className="mt-2 block text-xs text-slate-500">{movement.occurredAt}</time></li>)}
                </ol>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, icon, detail, trend, warning = false }: {
  label: string;
  value: string;
  icon: ReactNode;
  detail: string;
  trend?: number | null;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0 border border-brand-line bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 text-slate-500"><p className="text-sm">{label}</p><span className={warning ? 'text-amber-700' : 'text-brand-blue'}>{icon}</span></div>
      <p className="mt-4 break-words text-2xl font-semibold tracking-tight tabular-nums text-brand-navy">{value}</p>
      <p className={`mt-2 flex items-center gap-1 text-xs ${warning ? 'text-amber-800' : trend === undefined || trend === null || trend >= 0 ? 'text-slate-500' : 'text-rose-700'}`}>
        {trend !== undefined && trend !== null && (trend >= 0 ? <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDownRight aria-hidden="true" className="h-3.5 w-3.5" />)}
        {detail}
      </p>
    </div>
  );
}

export function filterRetailInventory(items: RetailInventoryItem[], search: string, type: RetailItemType | 'all') {
  const query = search.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matchesQuery = !query || [item.name, item.sku, item.barcode ?? '', item.branchName].some((value) => value.toLocaleLowerCase().includes(query));
    return matchesQuery && (type === 'all' || item.itemType === type);
  });
}

export function RetailInventoryCatalog({
  state,
  items = [],
  currencyCode,
  embedded = false,
}: {
  state: RetailViewState;
  items?: RetailInventoryItem[];
  currencyCode: string;
  embedded?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<RetailItemType | 'all'>('all');
  const filteredItems = useMemo(() => filterRetailInventory(items, search, selectedType), [items, search, selectedType]);
  const Heading = embedded ? 'h2' : 'h1';

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="eyebrow mb-3">Retail operations</p>
          <Heading className="break-words text-3xl font-semibold tracking-[-0.045em]">Product and stock</Heading>
          <p className="mt-2 text-sm text-slate-600">Manage product details and see stock by operating location.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled aria-describedby="inventory-actions-help">Import products</Button>
          <Button disabled aria-describedby="inventory-actions-help">Add product</Button>
        </div>
      </header>

      <p id="inventory-actions-help" className="border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
        Product changes and imports are disabled until their verified backend actions are available.
      </p>

      {state !== 'ready' ? <StatePanel state={state} label="Product inventory" /> : items.length === 0 ? <StatePanel state="empty" label="Product inventory" /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <span className="sr-only">Search products</span>
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU, barcode or location" className="min-h-11 w-full border border-brand-line bg-white py-2 pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-blue" />
            </label>
            <label className="block">
              <span className="sr-only">Filter by item type</span>
              <select value={selectedType} onChange={(event) => setSelectedType(event.target.value as RetailItemType | 'all')} className="min-h-11 w-full border border-brand-line bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-blue">
                <option value="all">All item types</option>
                {Object.entries(itemTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          {filteredItems.length === 0 ? (
            <p role="status" className="border border-brand-line bg-slate-50 p-4 text-sm text-slate-600">No products match those filters.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto border border-brand-line md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">SKU / barcode</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 text-right font-medium">On hand</th><th className="px-4 py-3 text-right font-medium">Selling price</th></tr></thead>
                  <tbody>{filteredItems.map((item) => <InventoryRow key={item.id} item={item} currencyCode={currencyCode} />)}</tbody>
                </table>
              </div>
              <ul aria-label="Product inventory" className="space-y-3 md:hidden">
                {filteredItems.map((item) => <li key={item.id} className="min-w-0 border border-brand-line bg-white p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium text-brand-navy">{item.name}</p><p className="mt-1 break-all font-mono text-xs text-slate-600">{item.sku}{item.barcode ? ` · ${item.barcode}` : ''}</p></div><span className="shrink-0 border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{itemTypeLabels[item.itemType]}</span></div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs"><div><dt className="text-slate-500">Location</dt><dd className="mt-1 break-words text-slate-800">{item.branchName}</dd></div><div><dt className="text-slate-500">On hand</dt><dd className="mt-1 tabular-nums text-slate-800">{item.quantityOnHand} {item.unit}</dd></div><div><dt className="text-slate-500">Selling price</dt><dd className="mt-1 tabular-nums text-slate-800">{formatCurrency(item.sellingPrice, currencyCode)}</dd></div><div><dt className="text-slate-500">Expiry</dt><dd className="mt-1 text-slate-800">{item.expiryDate ?? 'Not applicable'}</dd></div></dl>
                </li>)}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function InventoryRow({ item, currencyCode }: { item: RetailInventoryItem; currencyCode: string }) {
  return (
    <tr className="border-t border-brand-line align-top">
      <td className="px-4 py-3"><p className="font-medium text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.expiryDate ? `Expiry ${item.expiryDate}` : 'No expiry tracking'}</p></td>
      <td className="px-4 py-3"><p className="font-mono text-xs text-slate-800">{item.sku}</p><p className="mt-1 font-mono text-xs text-slate-500">{item.barcode ?? 'No barcode'}</p></td>
      <td className="px-4 py-3"><span className="inline-flex border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{itemTypeLabels[item.itemType]}</span></td>
      <td className="px-4 py-3 text-slate-700">{item.branchName}</td>
      <td className="px-4 py-3 text-right tabular-nums">{item.quantityOnHand} {item.unit}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.sellingPrice, currencyCode)}</td>
    </tr>
  );
}
