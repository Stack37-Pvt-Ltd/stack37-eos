'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  Printer,
  Clock,
  TrendingUp,
  ShoppingBag,
  RotateCcw,
  Eye,
  EyeOff,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';
import {
  addScannedProduct,
  calculateDiscountedTotal,
  calculateProviderCommission,
  findProductByBarcode,
  sumTenderAmounts,
  toMinorUnits,
} from '../../lib/retail/checkout';
import type { RetailTenderMethod } from '../../lib/retail/checkout';
import { recordRetailSaleAction, getCashierSalesMetricsAction } from '../../lib/actions/retail';

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

type Tender = { method: RetailTenderMethod; amount: string };

type Receipt = {
  saleId: string;
  receiptNumber: string;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  customer: { id: string; name: string; phone: string } | null;
  tenders: Array<{ method: RetailTenderMethod; amount: number }>;
  providerSettlements: Array<{
    provider: 'uber' | 'pickme';
    commissionRate: number;
    grossAmount: number;
    commissionAmount: number;
    netSettlement: number;
  }>;
  lines: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  createdAt: string;
  replayed: boolean;
};

export type SalesMetrics = {
  salesToday: number;
  grossSalesToday: number;
  salesYesterday: number;
  mySalesCountToday: number;
  totalSalesCount: number;
  currency?: string;
};

const tenderMethods: Array<{ id: RetailTenderMethod; label: string }> = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card (processed externally)' },
  { id: 'uber', label: 'Uber' },
  { id: 'pickme', label: 'PickMe' },
];

const QUICK_DISCOUNTS = [0, 5, 10, 15, 20];

function formatReceiptTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Colombo',
  }).format(new Date(value));
}

export function RetailPointOfSale({
  organizationId,
  branchId,
  organizationName,
  branchName,
  products,
  currency,
  salesPermission,
  settingsHref,
  uberCommissionRate,
  pickmeCommissionRate,
  showStockBalances = true,
  initialMetrics,
}: {
  organizationId: string;
  branchId: string | null;
  organizationName: string;
  branchName: string;
  products: Product[];
  currency: string;
  salesPermission: boolean;
  settingsHref: string;
  uberCommissionRate: number | null;
  pickmeCommissionRate: number | null;
  showStockBalances?: boolean;
  initialMetrics?: SalesMetrics;
}) {
  const router = useRouter();
  const [basket, setBasket] = React.useState<Record<string, number>>({});
  const basketRef = React.useRef<Record<string, number>>({});
  const [query, setQuery] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState('All');
  const [discountPercent, setDiscountPercent] = React.useState('0');
  const [includeCustomer, setIncludeCustomer] = React.useState(false);
  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [tenders, setTenders] = React.useState<Tender[]>([{ method: 'cash', amount: '0.00' }]);
  const [cashTendered, setCashTendered] = React.useState<string>('');
  const [showStock, setShowStock] = React.useState(showStockBalances);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const [metrics, setMetrics] = React.useState<SalesMetrics | null>(initialMetrics || null);
  const [colomboTime, setColomboTime] = React.useState('');
  const [justAddedId, setJustAddedId] = React.useState<string | null>(null);

  const scanInput = React.useRef<HTMLInputElement>(null);
  const printAfterSave = React.useRef(false);

  // Live Colombo Clock
  React.useEffect(() => {
    function updateClock() {
      const now = new Date();
      setColomboTime(
        now.toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Colombo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live cashier metrics
  const refreshMetrics = React.useCallback(async () => {
    if (!branchId) return;
    try {
      const res = await getCashierSalesMetricsAction({ organizationId, branchId });
      if (res.success && res.data) {
        setMetrics(res.data);
      }
    } catch {
      // Non-blocking
    }
  }, [organizationId, branchId]);

  React.useEffect(() => {
    if (branchId && !initialMetrics) {
      void refreshMetrics();
    }
  }, [branchId, initialMetrics, refreshMetrics]);

  const formatter = React.useMemo(
    () => new Intl.NumberFormat('en-GB', { style: 'currency', currency }),
    [currency]
  );

  // Fast O(1) Barcode & SKU Index
  const productIndex = React.useMemo(() => {
    const byBarcode = new Map<string, Product>();
    const bySku = new Map<string, Product>();
    for (const p of products) {
      if (p.barcode) byBarcode.set(p.barcode.trim().toLowerCase(), p);
      if (p.sku) bySku.set(p.sku.trim().toLowerCase(), p);
    }
    return { byBarcode, bySku };
  }, [products]);

  // Extract distinct categories
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category_name && p.category_name.trim()) {
        set.add(p.category_name.trim());
      }
    }
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  // Cart Lines calculation
  const cartLines = React.useMemo(
    () =>
      products
        .filter((product) => (basket[product.id] || 0) > 0)
        .map((product) => ({ product, quantity: basket[product.id] })),
    [basket, products]
  );

  const subtotal =
    cartLines.reduce(
      (sum, line) => sum + Math.round(Number(line.product.selling_price) * line.quantity * 100),
      0
    ) / 100;

  const discount = calculateDiscountedTotal(subtotal, Number(discountPercent));

  const tenderRows =
    tenders.length === 1
      ? [{ ...tenders[0], amount: discount.total.toFixed(2) }]
      : tenders;

  const tenderedTotal = sumTenderAmounts(tenderRows);
  const remaining = Math.round((discount.total - tenderedTotal) * 100) / 100;

  // Cash change calculation
  const cashChangeDue = React.useMemo(() => {
    if (tenders.length !== 1 || tenders[0].method !== 'cash') return null;
    const tenderedVal = Number.parseFloat(cashTendered);
    if (!Number.isFinite(tenderedVal) || tenderedVal < discount.total) return null;
    return Math.round((tenderedVal - discount.total) * 100) / 100;
  }, [tenders, cashTendered, discount.total]);

  const providerSettlements = tenderRows.flatMap((tender) => {
    if (tender.method !== 'uber' && tender.method !== 'pickme') return [];
    const rate = tender.method === 'uber' ? uberCommissionRate : pickmeCommissionRate;
    const settlement = calculateProviderCommission(tender.amount, rate);
    return [{ provider: tender.method, rate, amount: Number(tender.amount) || 0, settlement }];
  });

  const missingProviderRate = providerSettlements.some((row) => row.rate === null);

  // Fast filtered catalog search
  const filteredProducts = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCat = activeCategory === 'All' || product.category_name === activeCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        (product.barcode && product.barcode.toLowerCase().includes(q))
      );
    });
  }, [products, query, activeCategory]);

  React.useEffect(() => {
    if (!receipt || !printAfterSave.current) return;
    printAfterSave.current = false;
    window.print();
  }, [receipt]);

  function triggerAddFeedback(productId: string) {
    setJustAddedId(productId);
    setTimeout(() => setJustAddedId(null), 300);
  }

  function addProduct(product: Product) {
    const result = addScannedProduct(basketRef.current, product);
    if (!result.added) {
      setError(
        result.reason === 'out_of_stock'
          ? `${product.name} is out of stock at this branch.`
          : `Only ${product.quantity} unit(s) of ${product.name} are available.`
      );
      return;
    }
    setError(null);
    basketRef.current = result.basket;
    setBasket(result.basket);
    triggerAddFeedback(product.id);
  }

  function scanBarcode(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const rawVal = event.currentTarget.value.trim();
    if (!rawVal) return;

    const lower = rawVal.toLowerCase();
    // Fast O(1) exact lookup by barcode or SKU
    const matched =
      productIndex.byBarcode.get(lower) ||
      productIndex.bySku.get(lower) ||
      findProductByBarcode(products, rawVal);

    event.currentTarget.value = '';

    if (!matched) {
      // Fallback: check if exactly 1 item matches query
      if (filteredProducts.length === 1) {
        addProduct(filteredProducts[0]);
        setQuery('');
        return;
      }
      setError(`No active product matches barcode or SKU “${rawVal}”.`);
      return;
    }
    addProduct(matched);
  }

  function changeQuantity(product: Product, delta: number) {
    const next = (basketRef.current[product.id] || 0) + delta;
    if (next > product.quantity) {
      setError(`Only ${product.quantity} unit(s) of ${product.name} are available.`);
      return;
    }
    const updated = { ...basketRef.current };
    if (next <= 0) delete updated[product.id];
    else updated[product.id] = next;
    basketRef.current = updated;
    setBasket(updated);
    setError(null);
  }

  function removeProductFromCart(productId: string) {
    const updated = { ...basketRef.current };
    delete updated[productId];
    basketRef.current = updated;
    setBasket(updated);
    setError(null);
  }

  function clearBill() {
    basketRef.current = {};
    setBasket({});
    setDiscountPercent('0');
    setCashTendered('');
    setError(null);
    setNotice(null);
    if (scanInput.current) {
      scanInput.current.focus();
    }
  }

  function addTender() {
    if (tenders.length >= tenderMethods.length) return;
    const nextMethod = tenderMethods.find(
      ({ id }) => !tenders.some((tender) => tender.method === id)
    )?.id;
    if (!nextMethod) return;
    if (tenders.length === 1) {
      const firstCents = Math.floor(toMinorUnits(discount.total) / 2);
      const secondCents = toMinorUnits(discount.total) - firstCents;
      setTenders([
        { method: tenders[0].method, amount: (firstCents / 100).toFixed(2) },
        { method: nextMethod, amount: (secondCents / 100).toFixed(2) },
      ]);
      return;
    }
    const outstanding = Math.max(
      0,
      toMinorUnits(discount.total) -
        tenders.reduce((sum, tender) => sum + toMinorUnits(tender.amount), 0)
    );
    setTenders([...tenders, { method: nextMethod, amount: (outstanding / 100).toFixed(2) }]);
  }

  function updateTender(index: number, changes: Partial<Tender>) {
    setTenders((current) =>
      current.map((tender, row) => (row === index ? { ...tender, ...changes } : tender))
    );
  }

  function removeTender(index: number) {
    setTenders((current) => current.filter((_, row) => row !== index));
  }

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId || !salesPermission || !cartLines.length || busy) return;
    if (remaining !== 0) {
      setError(
        remaining > 0
          ? `Payment is short by ${formatter.format(remaining)}.`
          : `Payment exceeds the bill by ${formatter.format(Math.abs(remaining))}.`
      );
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await recordRetailSaleAction({
        organizationId,
        branchId,
        idempotencyKey: crypto.randomUUID(),
        discountPercent: Number(discountPercent),
        customer: includeCustomer ? { name: customerName, phone: customerPhone } : null,
        tenders: tenderRows.map(({ method, amount }) => ({ method, amount: Number(amount) })),
        lines: cartLines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      });
      if (!result.success || !result.data) {
        setError(result.error || 'Checkout could not be completed. No sale was recorded.');
        return;
      }
      const savedReceipt = result.data as Receipt;
      setReceipt(savedReceipt);
      printAfterSave.current = true;
      basketRef.current = {};
      setBasket({});
      setDiscountPercent('0');
      setCashTendered('');
      setIncludeCustomer(false);
      setCustomerName('');
      setCustomerPhone('');
      setTenders([{ method: 'cash', amount: '0.00' }]);
      setQuery('');
      setNotice(
        `Sale recorded as ${savedReceipt.receiptNumber}. The receipt is ready to print again below.`
      );
      void refreshMetrics();
      router.refresh();
    } catch {
      setError('Checkout could not be completed. Refresh the page and try again.');
    } finally {
      setBusy(false);
      if (scanInput.current) {
        scanInput.current.focus();
      }
    }
  }

  return (
    <>
      <section className="print:hidden space-y-4" aria-labelledby="retail-pos-title">
        {/* Top Cashier Sales Metrics Strip - Inspired by TCloudEats */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="border-r border-slate-200 pr-4">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Today&apos;s Sales
              </span>
              <span className="text-base font-bold text-brand-navy">
                {formatter.format(metrics?.grossSalesToday ?? 0)}
              </span>
              <span className="ml-1.5 text-xs text-slate-500">
                ({metrics?.salesToday ?? 0} sales)
              </span>
            </div>
            <div className="border-r border-slate-200 pr-4">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Yesterday&apos;s Sales
              </span>
              <span className="text-sm font-semibold text-slate-700">
                {formatter.format(metrics?.salesYesterday ?? 0)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Total Store Sales
              </span>
              <span className="text-sm font-semibold text-slate-700">
                {metrics?.totalSalesCount ?? 0} orders
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {colomboTime && (
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-medium text-slate-700">
                <Clock className="h-3.5 w-3.5 text-brand-blue" />
                <span>{colomboTime} • COLOMBO</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowStock((prev) => !prev)}
              title={showStock ? 'Hide stock quantities' : 'Show stock quantities'}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {showStock ? (
                <>
                  <Eye className="h-3.5 w-3.5" /> <span>Stock visible</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> <span>Stock hidden</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="sr-only">
          <h2 id="retail-pos-title">Point of sale</h2>
          <p>Scan each barcode or search the catalogue. Completed sales reduce stock atomically.</p>
        </div>

        <Alert variant="info" title="Payment and receipt">
          Cash, card, Uber and PickMe are recorded as cashier-selected payment methods. Card charges and delivery-provider payments happen outside STACK37. This prints a sales receipt; tax is not calculated.
        </Alert>

        {!salesPermission && (
          <Alert variant="warning">
            Your role does not have checkout permission. An administrator can assign the Cashier role.
          </Alert>
        )}
        {!branchId && <Alert variant="warning">Choose an assigned branch before checkout.</Alert>}
        {error && <Alert variant="error" title="Checkout needs attention">{error}</Alert>}
        {notice && (
          <Alert variant="success" title="Sale completed">
            {notice}
            {receipt && (
              <Button type="button" variant="outline" className="ml-3" onClick={() => window.print()}>
                Print receipt again
              </Button>
            )}
          </Alert>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(340px,420px)]">
          {/* Left Column: Fast Barcode Scanner, Search, Categories, & Catalog */}
          <div className="min-w-0 space-y-3">
            {/* High-speed Barcode Scanner Box */}
            <div className="relative rounded-xl border-2 border-brand-blue bg-white p-3 shadow-xs">
              <label htmlFor="pos-barcode-scanner" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-blue">
                <Barcode className="h-4 w-4" /> Scan barcode or SKU
              </label>
              <div className="relative mt-1">
                <input
                  id="pos-barcode-scanner"
                  ref={scanInput}
                  autoFocus
                  type="text"
                  aria-label="Scan barcode"
                  placeholder="Scan a product barcode and press Enter"
                  onKeyDown={scanBarcode}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 pr-10 text-base font-mono outline-none focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
                />
                <span className="pointer-events-none absolute right-3 top-3 text-xs font-semibold text-slate-400">
                  ↵ Enter
                </span>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                aria-label="Search name, SKU or barcode"
                placeholder="Search products by name, SKU or barcode..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>

            {/* Category Filter Strip */}
            {categories.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {categories.map((cat) => {
                  const active = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        active
                          ? 'bg-brand-blue text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Product Grid / Cards Catalog */}
            <div className="max-h-[58vh] overflow-y-auto rounded-xl border border-brand-line bg-slate-50/50 p-2">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
                {filteredProducts.map((product) => {
                  const qtyInCart = basket[product.id] || 0;
                  const isPulsing = justAddedId === product.id;
                  const isOutOfStock = product.quantity <= 0;
                  const isMaxInCart = qtyInCart >= product.quantity;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={!salesPermission || isOutOfStock || isMaxInCart}
                      onClick={() => addProduct(product)}
                      className={`relative flex flex-col justify-between rounded-xl border bg-white p-3 text-left transition-all cursor-pointer active:scale-[0.98] min-h-[96px] ${
                        isOutOfStock
                          ? 'opacity-50 cursor-not-allowed border-slate-200'
                          : 'border-slate-200 hover:border-brand-blue hover:shadow-xs'
                      } ${isPulsing ? 'ring-2 ring-emerald-500 scale-[0.97]' : ''}`}
                    >
                      {qtyInCart > 0 && (
                        <span className="absolute right-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-blue px-1.5 text-[11px] font-bold text-white shadow-xs">
                          {qtyInCart}
                        </span>
                      )}
                      <div>
                        <h4 className="line-clamp-2 pr-5 text-xs font-semibold text-brand-navy">
                          {product.name}
                        </h4>
                        <p className="mt-1 text-[11px] font-mono text-slate-500">
                          {product.sku}
                        </p>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {formatter.format(Number(product.selling_price))}
                        </span>
                        {showStock && (
                          <span
                            className={`text-[10px] font-semibold ${
                              isOutOfStock
                                ? 'text-rose-600'
                                : product.quantity <= 5
                                ? 'text-amber-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {isOutOfStock ? 'Out of stock' : `${product.quantity} in stock`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {!filteredProducts.length && (
                <div className="p-8 text-center text-sm text-slate-500">
                  No matching active products at this branch.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: UK Super Bill & Checkout Form */}
          <form
            onSubmit={checkout}
            className="flex flex-col justify-between rounded-xl border border-brand-line bg-white p-4 shadow-xs"
          >
            <div className="space-y-4">
              {/* Bill Header */}
              <div className="flex items-center justify-between border-b border-brand-line pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-brand-blue" />
                  <h3 className="font-bold text-brand-navy">UK Super Bill</h3>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-brand-blue">
                    {cartLines.length} {cartLines.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                {cartLines.length > 0 && (
                  <button
                    type="button"
                    onClick={clearBill}
                    className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 transition cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Clear Bill
                  </button>
                )}
              </div>

              {/* Bill Cart Items */}
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {cartLines.length ? (
                  cartLines.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-brand-navy">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatter.format(Number(product.selling_price))} ea
                        </p>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Remove one ${product.name}`}
                          onClick={() => changeQuantity(product, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-6 text-center text-xs font-bold font-mono">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add one ${product.name}`}
                          disabled={quantity >= product.quantity}
                          onClick={() => changeQuantity(product, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Line Total & Remove Item Button */}
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="min-w-16 text-right text-xs font-bold text-slate-900 font-mono">
                          {formatter.format(Number(product.selling_price) * quantity)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${product.name} from bill`}
                          onClick={() => removeProductFromCart(product.id)}
                          className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                          title="Remove from cart"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      Scan or select products to build bill
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Hardware barcode scanner is live and ready
                    </p>
                  </div>
                )}
              </div>

              {/* Customer Details Accordion (Optional) */}
              <fieldset className="space-y-2 border-t border-brand-line pt-3">
                <legend className="font-semibold text-xs uppercase tracking-wider text-slate-600">
                  Customer details (optional)
                </legend>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCustomer}
                    onChange={(event) => setIncludeCustomer(event.target.checked)}
                    className="h-3.5 w-3.5 rounded-sm accent-brand-blue"
                  />
                  <span>Add a customer to this receipt</span>
                </label>
                {includeCustomer && (
                  <div className="grid gap-2 pt-1 sm:grid-cols-2">
                    <label className="block space-y-1 text-xs font-medium text-slate-600">
                      Customer name
                      <input
                        required
                        minLength={1}
                        maxLength={160}
                        autoComplete="name"
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        className="min-h-9 w-full rounded-md border border-slate-300 px-2 text-xs"
                      />
                    </label>
                    <label className="block space-y-1 text-xs font-medium text-slate-600">
                      Phone number
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        className="min-h-9 w-full rounded-md border border-slate-300 px-2 text-xs"
                        placeholder="+94 77 123 4567"
                      />
                    </label>
                  </div>
                )}
              </fieldset>

              {/* Discount Selector */}
              <div className="space-y-1.5 border-t border-brand-line pt-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="pos-discount-input" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Order discount (%)
                  </label>
                  <div className="flex gap-1">
                    {QUICK_DISCOUNTS.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountPercent(String(pct))}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                          discountPercent === String(pct)
                            ? 'bg-brand-blue text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  id="pos-discount-input"
                  type="number"
                  min="0"
                  max="20"
                  step="0.01"
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(event.target.value)}
                  className="min-h-9 w-full rounded-md border border-slate-300 px-2 text-xs"
                />
              </div>

              {/* Subtotal, Discount & Total Due Summary */}
              <div className="space-y-1 rounded-lg bg-slate-50 p-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatter.format(subtotal)}</span>
                </div>
                {Number(discountPercent) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>
                      Discount ({Math.min(20, Math.max(0, Number(discountPercent) || 0))}%)
                    </span>
                    <span>−{formatter.format(discount.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-brand-navy">
                  <span>Total due</span>
                  <span className="text-base text-brand-blue">
                    {formatter.format(discount.total)}
                  </span>
                </div>
              </div>

              {/* Payment Tender Selection */}
              <fieldset className="space-y-2 border-t border-brand-line pt-2">
                <legend className="font-semibold text-xs uppercase tracking-wider text-slate-600">
                  Payment
                </legend>
                {tenders.map((tender, index) => (
                  <div
                    key={tender.method}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(95px,0.8fr)_auto] items-end gap-2"
                  >
                    <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">
                      <span>{tenders.length > 1 ? `Payment ${index + 1}` : 'Payment method'}</span>
                      <select
                        value={tender.method}
                        onChange={(event) =>
                          updateTender(index, { method: event.target.value as RetailTenderMethod })
                        }
                        className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
                      >
                        {tenderMethods
                          .filter(
                            ({ id }) =>
                              id === tender.method ||
                              !tenders.some((row, rowIndex) => rowIndex !== index && row.method === id)
                          )
                          .map(({ id, label }) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600">
                      <span>Amount</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        disabled={tenders.length === 1}
                        value={tenders.length === 1 ? discount.total.toFixed(2) : tender.amount}
                        onChange={(event) => updateTender(index, { amount: event.target.value })}
                        className="min-h-9 w-full rounded-md border border-slate-300 px-2 text-xs disabled:bg-slate-100"
                      />
                    </label>

                    {tenders.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Remove payment ${index + 1}`}
                        onClick={() => removeTender(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}

                {/* Cash Change Calculator (Single Cash Tender) */}
                {tenders.length === 1 && tenders[0].method === 'cash' && discount.total > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Cash Given by Customer:</span>
                      <input
                        type="number"
                        min={discount.total}
                        step="0.01"
                        placeholder={discount.total.toFixed(2)}
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="w-24 rounded border border-slate-300 bg-white px-2 py-0.5 text-right font-mono text-xs"
                      />
                    </div>
                    {cashChangeDue !== null && (
                      <div className="flex items-center justify-between font-bold text-emerald-800 pt-1 border-t border-slate-200">
                        <span>Change to Return:</span>
                        <span className="text-sm">{formatter.format(cashChangeDue)}</span>
                      </div>
                    )}
                  </div>
                )}

                {tenders.length < tenderMethods.length && (
                  <Button type="button" variant="outline" size="sm" onClick={addTender}>
                    Add split payment
                  </Button>
                )}

                {tenders.length > 1 && (
                  <p
                    role="status"
                    className={`text-xs ${
                      remaining === 0 ? 'text-emerald-800' : 'text-amber-800'
                    }`}
                  >
                    {remaining === 0
                      ? 'Payment matches the bill.'
                      : remaining > 0
                      ? `${formatter.format(remaining)} still due.`
                      : `${formatter.format(Math.abs(remaining))} over the bill.`}
                  </p>
                )}

                {providerSettlements.length > 0 && (
                  <div className="space-y-1 border-t border-brand-line pt-2 text-xs">
                    <p className="font-medium text-brand-navy">Provider commission and payout</p>
                    {providerSettlements.map((row) => (
                      <div key={row.provider} className="space-y-0.5">
                        <p className="font-medium capitalize text-slate-700">
                          {row.provider}{' '}
                          {row.rate === null ? 'rate not set' : `(${row.rate}%)`}
                        </p>
                        {row.settlement ? (
                          <>
                            <p className="flex justify-between text-slate-500">
                              <span>Commission</span>
                              <span>−{formatter.format(row.settlement.commission)}</span>
                            </p>
                            <p className="flex justify-between font-semibold text-slate-800">
                              <span>Estimated payout</span>
                              <span>{formatter.format(row.settlement.netSettlement)}</span>
                            </p>
                          </>
                        ) : (
                          <p className="text-amber-800">
                            Set this provider’s rate in{' '}
                            <Link href={settingsHref} className="font-medium underline">
                              Settings
                            </Link>{' '}
                            before checkout.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
            </div>

            {/* Complete Sale Action */}
            <div className="mt-4 pt-3 border-t border-brand-line">
              <Button
                type="submit"
                className="w-full min-h-11 font-bold text-sm bg-brand-blue hover:bg-blue-700 shadow-md transition"
                disabled={
                  !salesPermission ||
                  !branchId ||
                  !cartLines.length ||
                  (includeCustomer && (!customerName.trim() || !customerPhone.trim())) ||
                  remaining !== 0 ||
                  missingProviderRate ||
                  busy
                }
                isLoading={busy}
              >
                Complete sale &amp; print receipt
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Printable Receipt */}
      {receipt && (
        <section
          id="retail-sale-receipt"
          aria-label="Printable sale receipt"
          className="hidden print:block print:p-5"
        >
          <header className="mb-5 text-center">
            <p className="text-lg font-bold">{organizationName}</p>
            <p>{branchName}</p>
            <h2 className="mt-4 text-xl font-bold">Sales receipt</h2>
            <p className="mt-2">{receipt.receiptNumber}</p>
            <p>{formatReceiptTime(receipt.createdAt)}</p>
          </header>
          {receipt.customer && (
            <section className="mb-4 border-y border-black py-3">
              <p>Customer: {receipt.customer.name}</p>
              <p>Phone: {receipt.customer.phone}</p>
            </section>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((line) => (
                <tr key={`${receipt.saleId}-${line.productId}`} className="border-b border-slate-300">
                  <td className="py-2 pr-2">
                    {line.name}
                    <span className="block text-xs">{line.sku}</span>
                  </td>
                  <td className="py-2 text-right">{line.quantity}</td>
                  <td className="py-2 text-right">{formatter.format(line.unitPrice)}</td>
                  <td className="py-2 text-right">{formatter.format(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-4 max-w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatter.format(receipt.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Discount ({receipt.discountPercent}%)</dt>
              <dd>−{formatter.format(receipt.discountAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-black pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatter.format(receipt.total)}</dd>
            </div>
          </dl>
          <section className="mt-5 border-t border-black pt-3 text-sm">
            <p className="mb-2 font-semibold">Payment</p>
            {receipt.tenders.map((tender) => (
              <p
                key={`${receipt.saleId}-${tender.method}`}
                className="flex justify-between"
              >
                <span>
                  {tenderMethods.find(({ id }) => id === tender.method)?.label || tender.method}
                </span>
                <span>{formatter.format(tender.amount)}</span>
              </p>
            ))}
          </section>
          {receipt.providerSettlements.length > 0 && (
            <section className="mt-4 border-t border-black pt-3 text-sm">
              <p className="mb-2 font-semibold">Provider commission (store record)</p>
              {receipt.providerSettlements.map((settlement) => (
                <div key={`${receipt.saleId}-${settlement.provider}`}>
                  <p className="flex justify-between">
                    <span>
                      {settlement.provider === 'uber' ? 'Uber' : 'PickMe'} commission (
                      {settlement.commissionRate}%)
                    </span>
                    <span>{formatter.format(settlement.commissionAmount)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Estimated payout</span>
                    <span>{formatter.format(settlement.netSettlement)}</span>
                  </p>
                </div>
              ))}
            </section>
          )}
          <footer className="mt-8 border-t border-black pt-4 text-center text-xs">
            <p>Thank you for shopping with us.</p>
            <p className="mt-2">This is a sales receipt, not a tax invoice.</p>
          </footer>
        </section>
      )}
    </>
  );
}
