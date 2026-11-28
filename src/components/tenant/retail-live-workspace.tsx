'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  SlidersHorizontal,
  Package,
  Layers,
  ShoppingBag,
} from 'lucide-react';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';
import { ProductDraftReview } from './product-draft-review';
import { RetailPointOfSale } from './retail-point-of-sale';
import {
  isRetailModuleSection,
  RetailModulePanel,
  RetailModuleTabs,
  type RetailModuleSection,
} from './retail-module-sections';
import {
  adjustInventoryAction,
  recordBulkOpeningStockAction,
  createCustomProductAction,
  updateCustomProductAction,
  deactivateCustomProductAction,
} from '../../lib/actions/retail';

type Branch = { id: string; name: string };
export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_name?: string | null;
  selling_price: number;
  cost_price?: number;
  quantity: number;
};
type Dashboard = {
  salesToday: number;
  grossSalesToday: number;
  itemsSoldToday: number;
  activeProducts: number;
  lowStockProducts: number;
  pendingDraftReviews: number;
  currency: string;
};
type RetailView = 'overview' | 'pos' | 'inventory' | 'drafts' | RetailModuleSection;

const coreRetailSections = [
  { id: 'overview', label: 'Overview' },
  { id: 'pos', label: 'Point of sale' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'drafts', label: 'Product drafts' },
] as const;

export function RetailLiveWorkspace({
  organizationId,
  organizationSlug,
  organizationName,
  branchId,
  branches,
  products,
  dashboard,
  isOwner = false,
  inventoryPermission,
  salesPermission,
  customerReadPermission,
  customerManagePermission,
  customerWritesEnabled,
  uberCommissionRate,
  pickmeCommissionRate,
  loadError,
}: {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  branchId: string | null;
  branches: Branch[];
  products: Product[];
  dashboard: Dashboard | null;
  isOwner?: boolean;
  inventoryPermission: boolean;
  salesPermission: boolean;
  loadError?: string;
  customerReadPermission: boolean;
  customerManagePermission: boolean;
  customerWritesEnabled: boolean;
  uberCommissionRate: number | null;
  pickmeCommissionRate: number | null;
}) {
  const router = useRouter();
  const isCashierOnly = !isOwner && !inventoryPermission;
  const [view, setView] = React.useState<RetailView>(isCashierOnly ? 'pos' : 'overview');
  const [cashierMode, setCashierMode] = React.useState(isCashierOnly);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: 'success' | 'error'; message: string } | null>(
    null
  );

  // Stock Adjust Modal State
  const [adjustTarget, setAdjustTarget] = React.useState<Product | null>(null);
  const [adjustment, setAdjustment] = React.useState('');
  const [reason, setReason] = React.useState('');

  // Bulk Stocktake Modal State
  const [stocktakeOpen, setStocktakeOpen] = React.useState(false);

  // Add Product Modal State
  const [addProductOpen, setAddProductOpen] = React.useState(false);

  // Edit Product Modal State
  const [editProductTarget, setEditProductTarget] = React.useState<Product | null>(null);

  // Deactivate Product Modal State
  const [deactivateTarget, setDeactivateTarget] = React.useState<Product | null>(null);

  // Inventory Table Search & Filter
  const [inventorySearch, setInventorySearch] = React.useState('');

  const currency = dashboard?.currency || 'LKR';
  const formatter = React.useMemo(
    () => new Intl.NumberFormat('en-GB', { style: 'currency', currency }),
    [currency]
  );

  // Filtered Inventory Products
  const filteredInventoryProducts = React.useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category_name && p.category_name.toLowerCase().includes(q))
    );
  }, [products, inventorySearch]);

  async function saveAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!branchId || !adjustTarget || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await adjustInventoryAction({
        organizationId,
        branchId,
        productId: adjustTarget.id,
        quantityDelta: Number(adjustment),
        reason,
      });
      if (!result.success) {
        setNotice({
          kind: 'error',
          message: result.error || 'Stock adjustment could not be saved.',
        });
        return;
      }
      setAdjustTarget(null);
      setAdjustment('');
      setReason('');
      setNotice({
        kind: 'success',
        message: `Stock updated. New balance: ${result.data?.quantity ?? 'saved'}.`,
      });
      router.refresh();
    } catch {
      setNotice({ kind: 'error', message: 'Stock adjustment could not be saved.' });
    } finally {
      setBusy(false);
    }
  }

  // Pure Cashier Mode view: Cashier sees ONLY the POS Dashboard
  if (cashierMode) {
    return (
      <div className="min-w-0 space-y-4">
        {/* Cashier Station Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue text-white shadow-xs">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-brand-navy">UK Super POS Station</h1>
              <p className="text-xs text-slate-500">
                {organizationName} · {branches.find((b) => b.id === branchId)?.name || 'Retail branch'}
              </p>
            </div>
          </div>
          {isOwner && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCashierMode(false);
                setView('overview');
              }}
            >
              Exit Cashier Mode
            </Button>
          )}
        </header>

        <RetailPointOfSale
          organizationId={organizationId}
          branchId={branchId}
          organizationName={organizationName}
          branchName={branches.find((branch) => branch.id === branchId)?.name || 'Retail branch'}
          products={products}
          currency={currency}
          salesPermission={salesPermission}
          settingsHref={`/w/${encodeURIComponent(organizationSlug)}/settings`}
          uberCommissionRate={uberCommissionRate}
          pickmeCommissionRate={pickmeCommissionRate}
          showStockBalances={true}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="print:hidden flex flex-col gap-4 border-b border-brand-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Retail &amp; E-Commerce</p>
          <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">
            Store operations
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {organizationName} · branch stock and sales
          </p>
        </div>
        <div className="flex items-center gap-3">
          {salesPermission && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCashierMode(true);
                setView('pos');
              }}
              className="border-brand-blue text-brand-blue hover:bg-blue-50"
            >
              <ShoppingBag className="h-4 w-4 mr-1.5" /> Launch Cashier Station
            </Button>
          )}
          <label className="block space-y-1 text-xs font-medium text-slate-600">
            Operating branch
            <select
              aria-label="Operating branch"
              value={branchId || ''}
              onChange={(event) =>
                router.push(
                  `/w/${encodeURIComponent(organizationSlug)}/retail?branch=${encodeURIComponent(
                    event.target.value
                  )}`
                )
              }
              className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm text-brand-navy sm:min-w-56"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div
        role="group"
        aria-label="Retail sections"
        className="print:hidden max-w-full overflow-x-auto border-b border-brand-line pb-3"
      >
        <div className="flex w-max min-w-full flex-nowrap gap-2">
          {coreRetailSections.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={`min-h-10 shrink-0 border px-3 text-sm ${
                view === id
                  ? 'border-brand-blue bg-blue-50 font-semibold text-brand-navy'
                  : 'border-brand-line bg-white text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
          <RetailModuleTabs selected={view} onSelect={setView} />
        </div>
      </div>

      {notice && (
        <div className="print:hidden">
          <Alert variant={notice.kind} title={notice.kind === 'success' ? 'Saved' : 'Needs attention'}>
            {notice.message}
          </Alert>
        </div>
      )}
      {loadError && (
        <div className="print:hidden">
          <Alert variant="warning" title="Retail data unavailable">
            {loadError} Check that the reviewed retail migration has been applied to this environment.
            No sample totals are shown.
          </Alert>
        </div>
      )}
      {!branchId && (
        <div className="print:hidden">
          <Alert variant="info" title="No assigned branch">
            This account is not assigned to a retail branch. Ask a workspace administrator to assign a
            branch.
          </Alert>
        </div>
      )}

      {view === 'overview' && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-brand-navy">Today at this branch</h2>
            <p className="mt-1 text-sm text-slate-600">
              Live totals based on recorded sales and current stock.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Gross sales today', dashboard ? formatter.format(dashboard.grossSalesToday) : 'Unavailable'],
              ['Completed sales', dashboard?.salesToday ?? 'Unavailable'],
              ['Units sold', dashboard?.itemsSoldToday ?? 'Unavailable'],
              ['Low stock products', dashboard?.lowStockProducts ?? 'Unavailable'],
            ].map(([label, value]) => (
              <div key={label} className="border border-brand-line bg-white p-4">
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-4 text-2xl font-semibold text-brand-navy">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Start checkout', 'Search the product catalogue and record a sale.', 'pos'],
              ['Review stock', 'View on-hand quantities and record stock counts.', 'inventory'],
              ['Review imported products', 'Approve product drafts before they enter the catalogue.', 'drafts'],
            ].map(([title, detail, section]) => (
              <button
                key={section}
                type="button"
                onClick={() => setView(section as typeof view)}
                className="border border-brand-line bg-white p-4 text-left hover:bg-slate-50"
              >
                <strong className="text-brand-navy">{title}</strong>
                <p className="mt-2 text-sm leading-5 text-slate-600">{detail}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {view === 'pos' && (
        <RetailPointOfSale
          organizationId={organizationId}
          branchId={branchId}
          organizationName={organizationName}
          branchName={branches.find((branch) => branch.id === branchId)?.name || 'Retail branch'}
          products={products}
          currency={currency}
          salesPermission={salesPermission}
          settingsHref={`/w/${encodeURIComponent(organizationSlug)}/settings`}
          uberCommissionRate={uberCommissionRate}
          pickmeCommissionRate={pickmeCommissionRate}
        />
      )}

      {view === 'inventory' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-brand-navy">Branch inventory</h2>
              <p className="mt-1 text-sm text-slate-600">
                {products.length} products total in catalog · stock quantities are branch-specific.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {inventoryPermission && branchId && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setAddProductOpen(true)}
                    className="border-brand-blue text-brand-blue hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4 mr-1.5" /> Add Product
                  </Button>
                  <Button variant="outline" onClick={() => setStocktakeOpen(true)}>
                    Opening Stocktake
                  </Button>
                </>
              )}
            </div>
          </div>

          {!inventoryPermission && (
            <Alert variant="warning">
              Your role can view stock but cannot change it. An administrator can grant inventory access.
            </Alert>
          )}

          {/* Quick Search & Filter Bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search inventory by name, SKU, barcode, or category..."
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>

          {/* Product Inventory Table */}
          <div className="overflow-x-auto border border-brand-line bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">SKU / Barcode</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">On hand</th>
                  <th className="px-4 py-3">Retail Price</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventoryProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-brand-navy">{product.name}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      <div>{product.sku}</div>
                      {product.barcode && (
                        <div className="text-[11px] text-slate-400">{product.barcode}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {product.category_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          product.quantity <= 0
                            ? 'text-rose-600'
                            : product.quantity <= 5
                            ? 'text-amber-600'
                            : 'text-slate-800'
                        }`}
                      >
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {formatter.format(Number(product.selling_price))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!inventoryPermission}
                          onClick={() => {
                            setAdjustTarget(product);
                            setAdjustment('');
                            setReason('');
                          }}
                        >
                          Adjust
                        </Button>
                        {inventoryPermission && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditProductTarget(product)}
                              title="Edit product"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeactivateTarget(product)}
                              title="Remove product"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredInventoryProducts.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                {products.length === 0
                  ? 'No active products are available in this catalog.'
                  : 'No products match your search.'}
              </p>
            )}
          </div>
        </section>
      )}

      {view === 'drafts' && (
        <ProductDraftReview
          organizationId={organizationId}
          organizationName={organizationName}
          canPublish={inventoryPermission}
        />
      )}

      {isRetailModuleSection(view) ? (
        <RetailModulePanel
          section={view}
          organizationSlug={organizationSlug}
          organizationId={organizationId}
          branches={branches}
          branchId={branchId}
          products={products}
          dashboard={dashboard}
          canReadCustomers={customerReadPermission}
          canManageCustomers={customerManagePermission}
          customerWritesEnabled={customerWritesEnabled}
        />
      ) : null}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-adjust-title"
            className="w-full max-w-md space-y-4 border border-slate-300 bg-white p-5"
          >
            <h2 id="stock-adjust-title" className="text-xl font-semibold text-brand-navy">
              Adjust stock
            </h2>
            <p className="text-sm text-slate-600">
              {adjustTarget.name} · current balance {adjustTarget.quantity}
            </p>
            <form className="space-y-4" onSubmit={saveAdjustment}>
              <label className="block space-y-1 text-sm">
                Quantity change
                <input
                  required
                  type="number"
                  step="0.001"
                  value={adjustment}
                  onChange={(event) => setAdjustment(event.target.value)}
                  className="min-h-11 w-full border border-slate-300 px-3"
                  placeholder="Use a negative number to reduce stock"
                />
              </label>
              <label className="block space-y-1 text-sm">
                Reason
                <input
                  required
                  minLength={3}
                  maxLength={300}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-11 w-full border border-slate-300 px-3"
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAdjustTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={busy}>
                  Save adjustment
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Add Product Modal */}
      {addProductOpen && branchId && (
        <AddProductModal
          organizationId={organizationId}
          branchId={branchId}
          onClose={() => setAddProductOpen(false)}
          onSuccess={(newProduct) => {
            setAddProductOpen(false);
            setNotice({
              kind: 'success',
              message: `Product “${newProduct.name}” created successfully.`,
            });
            router.refresh();
          }}
        />
      )}

      {/* Edit Product Modal */}
      {editProductTarget && (
        <EditProductModal
          organizationId={organizationId}
          product={editProductTarget}
          onClose={() => setEditProductTarget(null)}
          onSuccess={(updatedProduct) => {
            setEditProductTarget(null);
            setNotice({
              kind: 'success',
              message: `Product “${updatedProduct.name}” updated successfully.`,
            });
            router.refresh();
          }}
        />
      )}

      {/* Deactivate Product Modal */}
      {deactivateTarget && (
        <DeactivateProductModal
          organizationId={organizationId}
          product={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onSuccess={() => {
            setDeactivateTarget(null);
            setNotice({
              kind: 'success',
              message: `Product “${deactivateTarget.name}” removed from active catalog.`,
            });
            router.refresh();
          }}
        />
      )}

      {/* Bulk Opening Stocktake Modal */}
      {stocktakeOpen && branchId && (
        <OpeningStocktakeModal
          products={products}
          organizationId={organizationId}
          branchId={branchId}
          branchName={branches.find((b) => b.id === branchId)?.name || 'Branch'}
          onClose={() => setStocktakeOpen(false)}
          onSuccess={(count) => {
            setStocktakeOpen(false);
            setNotice({
              kind: 'success',
              message: `Opening stock recorded for ${count} product${count === 1 ? '' : 's'}.`,
            });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Modal: Add Custom Product
// ============================================================================
function AddProductModal({
  organizationId,
  branchId,
  onClose,
  onSuccess,
}: {
  organizationId: string;
  branchId: string;
  onClose: () => void;
  onSuccess: (product: any) => void;
}) {
  const [name, setName] = React.useState('');
  const [categoryName, setCategoryName] = React.useState('');
  const [sellingPrice, setSellingPrice] = React.useState('');
  const [costPrice, setCostPrice] = React.useState('');
  const [barcode, setBarcode] = React.useState('');
  const [sku, setSku] = React.useState('');
  const [initialStock, setInitialStock] = React.useState('0');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedSelling = Number(sellingPrice);
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!Number.isFinite(parsedSelling) || parsedSelling < 0) {
      setError('Enter a valid selling price.');
      return;
    }

    setBusy(true);
    try {
      const res = await createCustomProductAction({
        organizationId,
        branchId,
        name: name.trim(),
        sellingPrice: parsedSelling,
        costPrice: costPrice ? Number(costPrice) : 0,
        barcode: barcode.trim() || null,
        sku: sku.trim() || null,
        categoryName: categoryName.trim() || null,
        initialStock: initialStock ? Number(initialStock) : 0,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
      } else {
        setError(res.error || 'Failed to create product.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-product-title"
        className="w-full max-w-lg space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-xl"
      >
        <div className="border-b border-brand-line pb-3">
          <h2 id="add-product-title" className="text-xl font-bold text-brand-navy">
            Add New Product
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Create a custom product in UK Super catalog and assign initial branch stock.
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-700">
              Product Name *
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Anchor Full Cream Milk Powder 400g"
              className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-700">
                Selling Price (LKR) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="1050.00"
                className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-700">
                Cost Price (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="950.00"
                className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-700">Barcode</label>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="e.g. 4791234567890"
                className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono outline-none focus:border-brand-blue"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-700">SKU</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Auto-generated if empty"
                className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono outline-none focus:border-brand-blue"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-700">Category</label>
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Dairy & Eggs"
                className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-700">
                Initial Stock Count
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                placeholder="0"
                className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-brand-line">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" isLoading={busy} className="bg-brand-blue hover:bg-blue-700">
              Save Product
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ============================================================================
// Modal: Edit Custom Product
// ============================================================================
function EditProductModal({
  organizationId,
  product,
  onClose,
  onSuccess,
}: {
  organizationId: string;
  product: Product;
  onClose: () => void;
  onSuccess: (product: any) => void;
}) {
  const [name, setName] = React.useState(product.name);
  const [categoryName, setCategoryName] = React.useState(product.category_name || '');
  const [sellingPrice, setSellingPrice] = React.useState(String(product.selling_price));
  const [costPrice, setCostPrice] = React.useState(
    product.cost_price != null ? String(product.cost_price) : ''
  );
  const [barcode, setBarcode] = React.useState(product.barcode || '');
  const [sku, setSku] = React.useState(product.sku);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedSelling = Number(sellingPrice);
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!Number.isFinite(parsedSelling) || parsedSelling < 0) {
      setError('Enter a valid selling price.');
      return;
    }

    setBusy(true);
    try {
      const res = await updateCustomProductAction({
        organizationId,
        productId: product.id,
        name: name.trim(),
        sellingPrice: parsedSelling,
        costPrice: costPrice ? Number(costPrice) : null,
        barcode: barcode.trim() || null,
        sku: sku.trim() || null,
        categoryName: categoryName.trim() || null,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
      } else {
        setError(res.error || 'Failed to update product.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-product-title"
        className="w-full max-w-lg space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-xl"
      >
        <div className="border-b border-brand-line pb-3">
          <h2 id="edit-product-title" className="text-xl font-bold text-brand-navy">
            Edit Product
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Update product details, selling price, barcode, or category.
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-700">
              Product Name *
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-700">
                Selling Price (LKR) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-700">
                Cost Price (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-700">Barcode</label>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono outline-none focus:border-brand-blue"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-700">SKU</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-mono outline-none focus:border-brand-blue"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-700">Category</label>
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-blue"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-brand-line">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" isLoading={busy} className="bg-brand-blue hover:bg-blue-700">
              Save Changes
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ============================================================================
// Modal: Deactivate / Remove Product
// ============================================================================
function DeactivateProductModal({
  organizationId,
  product,
  onClose,
  onSuccess,
}: {
  organizationId: string;
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await deactivateCustomProductAction({
        organizationId,
        productId: product.id,
      });

      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Failed to remove product.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-product-title"
        className="w-full max-w-md space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-xl"
      >
        <div className="border-b border-brand-line pb-3">
          <h2 id="deactivate-product-title" className="text-xl font-bold text-rose-700">
            Remove Product
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Deactivate product from live catalog and cashier POS.
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <p className="text-sm text-slate-700 leading-relaxed">
          Are you sure you want to remove <strong>{product.name}</strong> ({product.sku}) from the
          active inventory? It will no longer appear in POS or stock lists.
        </p>

        <div className="flex justify-end gap-2 pt-3 border-t border-brand-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            isLoading={busy}
            onClick={handleConfirm}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            Remove Product
          </Button>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// Modal: Bulk Opening Stocktake
// ============================================================================
function OpeningStocktakeModal({
  products,
  organizationId,
  branchId,
  branchName,
  onClose,
  onSuccess,
}: {
  products: Product[];
  organizationId: string;
  branchId: string;
  branchName: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}) {
  const [quantities, setQuantities] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of products) {
      map[p.id] = String(p.quantity ?? 0);
    }
    return map;
  });
  const [zeroOnly, setZeroOnly] = React.useState(true);
  const [quickFill, setQuickFill] = React.useState('50');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const displayedProducts = React.useMemo(() => {
    if (!zeroOnly) return products;
    return products.filter((p) => (p.quantity ?? 0) === 0);
  }, [products, zeroOnly]);

  function applyQuickFill() {
    const num = Number(quickFill);
    if (Number.isNaN(num) || num < 0) return;
    setQuantities((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if ((p.quantity ?? 0) === 0) {
          next[p.id] = String(num);
        }
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const itemsToUpdate: Array<{ productId: string; quantity: number }> = [];
    for (const p of products) {
      const valStr = quantities[p.id];
      const val = Number(valStr);
      if (!Number.isNaN(val) && val >= 0 && val !== (p.quantity ?? 0)) {
        itemsToUpdate.push({ productId: p.id, quantity: val });
      }
    }

    if (itemsToUpdate.length === 0) {
      setError('No quantity changes detected.');
      return;
    }

    setBusy(true);
    try {
      const res = await recordBulkOpeningStockAction({
        organizationId,
        branchId,
        items: itemsToUpdate,
      });

      if (res.success && res.data) {
        onSuccess(res.data.updatedCount);
      } else {
        setError(res.error || 'Failed to record opening stocktake.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="stocktake-title"
        className="w-full max-w-2xl space-y-4 border border-slate-300 bg-white p-6 max-h-[90vh] flex flex-col"
      >
        <div className="border-b border-brand-line pb-3">
          <h2 id="stocktake-title" className="text-xl font-semibold text-brand-navy">
            Opening Stocktake
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Branch: {branchName} · Set initial on-hand quantities for active products.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-700">Quick fill zero-stock items:</span>
            <input
              type="number"
              min="0"
              max="1000000"
              value={quickFill}
              onChange={(e) => setQuickFill(e.target.value)}
              className="w-20 border border-slate-300 bg-white px-2 py-1 text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={applyQuickFill}>
              Apply
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={zeroOnly}
              onChange={(e) => setZeroOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show zero-stock only ({products.filter((p) => (p.quantity ?? 0) === 0).length})
          </label>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4">
          <div className="flex-1 overflow-y-auto border border-brand-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Current</th>
                  <th className="px-4 py-2 w-32">New Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{p.sku}</td>
                    <td className="px-4 py-2 text-slate-600">{p.quantity ?? 0}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step="0.001"
                        value={quantities[p.id] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuantities((prev) => ({ ...prev, [p.id]: val }));
                        }}
                        className="w-full border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                  </tr>
                ))}
                {displayedProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-sm text-slate-500">
                      No matching products.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-brand-line">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" isLoading={busy}>
              Save Opening Stock
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
