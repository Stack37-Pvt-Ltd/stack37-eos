'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';
import { addScannedProduct, calculateDiscountedTotal, calculateProviderCommission, findProductByBarcode, sumTenderAmounts, toMinorUnits } from '../../lib/retail/checkout';
import type { RetailTenderMethod } from '../../lib/retail/checkout';
import { recordRetailSaleAction } from '../../lib/actions/retail';

type Product = { id: string; name: string; sku: string; barcode: string | null; selling_price: number; quantity: number };
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
  providerSettlements: Array<{ provider: 'uber' | 'pickme'; commissionRate: number; grossAmount: number; commissionAmount: number; netSettlement: number }>;
  lines: Array<{ productId: string; name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }>;
  createdAt: string;
  replayed: boolean;
};

const tenderMethods: Array<{ id: RetailTenderMethod; label: string }> = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card (processed externally)' },
  { id: 'uber', label: 'Uber' },
  { id: 'pickme', label: 'PickMe' },
];

function formatReceiptTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(value));
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
}) {
  const router = useRouter();
  const [basket, setBasket] = React.useState<Record<string, number>>({});
  const basketRef = React.useRef<Record<string, number>>({});
  const [query, setQuery] = React.useState('');
  const [discountPercent, setDiscountPercent] = React.useState('0');
  const [includeCustomer, setIncludeCustomer] = React.useState(false);
  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [tenders, setTenders] = React.useState<Tender[]>([{ method: 'cash', amount: '0.00' }]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const scanInput = React.useRef<HTMLInputElement>(null);
  const printAfterSave = React.useRef(false);

  const formatter = React.useMemo(() => new Intl.NumberFormat('en-GB', { style: 'currency', currency }), [currency]);
  const cartLines = React.useMemo(() => products
    .filter((product) => (basket[product.id] || 0) > 0)
    .map((product) => ({ product, quantity: basket[product.id] })), [basket, products]);
  const subtotal = cartLines.reduce((sum, line) => sum + Math.round(Number(line.product.selling_price) * line.quantity * 100), 0) / 100;
  const discount = calculateDiscountedTotal(subtotal, Number(discountPercent));
  const tenderRows = tenders.length === 1
    ? [{ ...tenders[0], amount: discount.total.toFixed(2) }]
    : tenders;
  const tenderedTotal = sumTenderAmounts(tenderRows);
  const remaining = Math.round((discount.total - tenderedTotal) * 100) / 100;
  const providerSettlements = tenderRows.flatMap((tender) => {
    if (tender.method !== 'uber' && tender.method !== 'pickme') return [];
    const rate = tender.method === 'uber' ? uberCommissionRate : pickmeCommissionRate;
    const settlement = calculateProviderCommission(tender.amount, rate);
    return [{ provider: tender.method, rate, amount: Number(tender.amount) || 0, settlement }];
  });
  const missingProviderRate = providerSettlements.some((row) => row.rate === null);
  const filteredProducts = products.filter((product) => `${product.name} ${product.sku} ${product.barcode || ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  React.useEffect(() => {
    if (!receipt || !printAfterSave.current) return;
    printAfterSave.current = false;
    window.print();
  }, [receipt]);

  function addProduct(product: Product) {
    const result = addScannedProduct(basketRef.current, product);
    if (!result.added) {
      setError(result.reason === 'out_of_stock' ? `${product.name} is out of stock at this branch.` : `Only ${product.quantity} unit(s) of ${product.name} are available.`);
      return;
    }
    setError(null);
    basketRef.current = result.basket;
    setBasket(result.basket);
  }

  function scanBarcode(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const barcode = event.currentTarget.value;
    const product = findProductByBarcode(products, barcode);
    event.currentTarget.value = '';
    if (!product) {
      setError(`No active product matches barcode “${barcode.trim()}”.`);
      return;
    }
    addProduct(product);
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

  function addTender() {
    if (tenders.length >= tenderMethods.length) return;
    const nextMethod = tenderMethods.find(({ id }) => !tenders.some((tender) => tender.method === id))?.id;
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
    const outstanding = Math.max(0, toMinorUnits(discount.total) - tenders.reduce((sum, tender) => sum + toMinorUnits(tender.amount), 0));
    setTenders([...tenders, { method: nextMethod, amount: (outstanding / 100).toFixed(2) }]);
  }

  function updateTender(index: number, changes: Partial<Tender>) {
    setTenders((current) => current.map((tender, row) => row === index ? { ...tender, ...changes } : tender));
  }

  function removeTender(index: number) {
    setTenders((current) => current.filter((_, row) => row !== index));
  }

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId || !salesPermission || !cartLines.length || busy) return;
    if (remaining !== 0) {
      setError(remaining > 0 ? `Payment is short by ${formatter.format(remaining)}.` : `Payment exceeds the bill by ${formatter.format(Math.abs(remaining))}.`);
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
      setIncludeCustomer(false);
      setCustomerName('');
      setCustomerPhone('');
      setTenders([{ method: 'cash', amount: '0.00' }]);
      setQuery('');
      setNotice(`Sale recorded as ${savedReceipt.receiptNumber}. The receipt is ready to print again below.`);
      router.refresh();
    } catch {
      setError('Checkout could not be completed. Refresh the page and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="print:hidden space-y-4" aria-labelledby="retail-pos-title">
      <div><h2 id="retail-pos-title" className="text-xl font-semibold text-brand-navy">Point of sale</h2><p className="mt-1 text-sm text-slate-600">Scan each barcode or search the catalogue. Completed sales reduce this branch’s stock atomically.</p></div>
      <Alert variant="info" title="Payment and receipt">Cash, card, Uber and PickMe are recorded as cashier-selected payment methods. Card charges and delivery-provider payments happen outside STACK37. This prints a sales receipt; tax is not calculated.</Alert>
      {!salesPermission && <Alert variant="warning">Your role does not have checkout permission. An administrator can assign the Cashier role.</Alert>}
      {!branchId && <Alert variant="warning">Choose an assigned branch before checkout.</Alert>}
      {error && <Alert variant="error" title="Checkout needs attention">{error}</Alert>}
      {notice && <Alert variant="success" title="Sale completed">{notice}{receipt && <Button type="button" variant="outline" className="ml-3" onClick={() => window.print()}>Print receipt again</Button>}</Alert>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="min-w-0 space-y-3">
          <label className="block space-y-1 text-sm font-medium text-slate-700">Scan barcode<input ref={scanInput} autoFocus type="text" inputMode="none" aria-label="Scan barcode" placeholder="Scan a product barcode and press Enter" onKeyDown={scanBarcode} className="min-h-12 w-full border-2 border-brand-blue px-3 text-base" /></label>
          <label className="block space-y-1 text-sm text-slate-600">Or search products<input type="search" aria-label="Search name, SKU or barcode" placeholder="Search name, SKU or barcode" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full border border-slate-300 px-3 text-sm" /></label>
          <div className="max-h-[55vh] overflow-auto border border-brand-line bg-white">{filteredProducts.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-brand-line p-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-brand-navy">{product.name}</p><p className="text-xs text-slate-500">{product.sku} · {product.quantity} in stock</p></div><div className="flex shrink-0 items-center gap-3"><span className="text-sm">{formatter.format(Number(product.selling_price))}</span><Button type="button" size="sm" disabled={!salesPermission || product.quantity <= (basket[product.id] || 0)} onClick={() => addProduct(product)}>Add</Button></div></div>)}{!filteredProducts.length && <p className="p-5 text-sm text-slate-500">No matching active products at this branch.</p>}</div>
        </div>
        <form onSubmit={checkout} className="min-w-0 space-y-4 border border-brand-line bg-white p-4">
          <h3 className="font-semibold text-brand-navy">Current sale</h3>
          <div className="max-h-56 space-y-3 overflow-y-auto">{cartLines.length ? cartLines.map(({ product, quantity }) => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-brand-line pb-3 text-sm"><div className="min-w-0"><p className="truncate font-medium text-brand-navy">{product.name}</p><p className="text-xs text-slate-500">{formatter.format(Number(product.selling_price))} each</p></div><div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" size="sm" aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product, -1)}>−</Button><span className="min-w-5 text-center">{quantity}</span><Button type="button" variant="outline" size="sm" aria-label={`Add one ${product.name}`} disabled={quantity >= product.quantity} onClick={() => changeQuantity(product, 1)}>+</Button></div><span className="shrink-0">{formatter.format(Number(product.selling_price) * quantity)}</span></div>) : <p className="text-sm text-slate-500">Scan or add products to start a sale.</p>}</div>

          <fieldset className="space-y-3 border-t border-brand-line pt-3"><legend className="font-medium text-brand-navy">Customer details (optional)</legend>
            <label className="flex min-h-10 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeCustomer} onChange={(event) => setIncludeCustomer(event.target.checked)} className="h-4 w-4 accent-brand-blue" />Add a customer to this receipt</label>
            {includeCustomer && <>
              <label className="block space-y-1 text-xs font-medium text-slate-600">Customer name<input required minLength={1} maxLength={160} autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="min-h-10 w-full border border-slate-300 px-2 text-sm" /></label>
              <label className="block space-y-1 text-xs font-medium text-slate-600">Phone number<input required type="tel" inputMode="tel" autoComplete="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="min-h-10 w-full border border-slate-300 px-2 text-sm" placeholder="+94 77 123 4567" /></label>
              <p className="text-xs text-slate-500">Saved to the customer record for future e-bills. SMS sending is not enabled yet.</p>
            </>}
          </fieldset>

          <label className="block space-y-1 text-xs font-medium text-slate-600">Order discount (%)<input type="number" min="0" max="20" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} className="min-h-10 w-full border border-slate-300 px-2 text-sm" /></label>
          <div className="space-y-1 border-t border-brand-line pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{formatter.format(subtotal)}</span></div><div className="flex justify-between text-emerald-800"><span>Discount ({Math.min(20, Math.max(0, Number(discountPercent) || 0))}%)</span><span>−{formatter.format(discount.discountAmount)}</span></div><div className="flex justify-between font-semibold text-brand-navy"><span>Total due</span><span>{formatter.format(discount.total)}</span></div></div>

          <fieldset className="space-y-3 border-t border-brand-line pt-3"><legend className="font-medium text-brand-navy">Payment</legend>
            {tenders.map((tender, index) => <div key={tender.method} className="grid grid-cols-[minmax(0,1fr)_minmax(95px,0.8fr)_auto] items-end gap-2">
              <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600"><span>{tenders.length > 1 ? `Payment ${index + 1}` : 'Payment method'}</span><select value={tender.method} onChange={(event) => updateTender(index, { method: event.target.value as RetailTenderMethod })} className="min-h-10 w-full border border-slate-300 bg-white px-2 text-sm">{tenderMethods.filter(({ id }) => id === tender.method || !tenders.some((row, rowIndex) => rowIndex !== index && row.method === id)).map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label>
              <label className="min-w-0 space-y-1 text-xs font-medium text-slate-600"><span>Amount</span><input type="number" min="0.01" step="0.01" required disabled={tenders.length === 1} value={tenders.length === 1 ? discount.total.toFixed(2) : tender.amount} onChange={(event) => updateTender(index, { amount: event.target.value })} className="min-h-10 w-full border border-slate-300 px-2 text-sm disabled:bg-slate-50" /></label>
              {tenders.length > 1 && <Button type="button" variant="outline" size="sm" aria-label={`Remove payment ${index + 1}`} onClick={() => removeTender(index)}>Remove</Button>}
            </div>)}
            {tenders.length < tenderMethods.length && <Button type="button" variant="outline" onClick={addTender}>Add split payment</Button>}
            {tenders.length > 1 && <p role="status" className={`text-sm ${remaining === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>{remaining === 0 ? 'Payment matches the bill.' : remaining > 0 ? `${formatter.format(remaining)} still due.` : `${formatter.format(Math.abs(remaining))} over the bill.`}</p>}
            {providerSettlements.length > 0 && <div className="space-y-2 border-t border-brand-line pt-3 text-sm"><p className="font-medium text-brand-navy">Provider commission and payout</p>{providerSettlements.map((row) => <div key={row.provider} className="space-y-1"><p className="font-medium capitalize">{row.provider} {row.rate === null ? 'rate not set' : `(${row.rate}%)`}</p>{row.settlement ? <><p className="flex justify-between"><span>Commission</span><span>−{formatter.format(row.settlement.commission)}</span></p><p className="flex justify-between"><span>Estimated payout</span><span>{formatter.format(row.settlement.netSettlement)}</span></p></> : <p className="text-amber-800">Set this provider’s rate in <Link href={settingsHref} className="font-medium underline">Settings</Link> before checkout.</p>}</div>)}<p className="text-xs leading-5 text-slate-500">Commission is recorded against the provider payment; it does not change the customer’s bill or product price.</p></div>}
          </fieldset>
          <Button type="submit" className="w-full" disabled={!salesPermission || !branchId || !cartLines.length || (includeCustomer && (!customerName.trim() || !customerPhone.trim())) || remaining !== 0 || missingProviderRate || busy} isLoading={busy}>Complete sale &amp; print receipt</Button>
        </form>
      </div>
    </section>

    {receipt && <section id="retail-sale-receipt" aria-label="Printable sale receipt" className="hidden print:block print:p-5">
      <header className="mb-5 text-center"><p className="text-lg font-bold">{organizationName}</p><p>{branchName}</p><h2 className="mt-4 text-xl font-bold">Sales receipt</h2><p className="mt-2">{receipt.receiptNumber}</p><p>{formatReceiptTime(receipt.createdAt)}</p></header>
      {receipt.customer && <section className="mb-4 border-y border-black py-3"><p>Customer: {receipt.customer.name}</p><p>Phone: {receipt.customer.phone}</p></section>}
      <table className="w-full text-sm"><thead><tr className="border-b border-black text-left"><th className="py-2">Item</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{receipt.lines.map((line) => <tr key={`${receipt.saleId}-${line.productId}`} className="border-b border-slate-300"><td className="py-2 pr-2">{line.name}<span className="block text-xs">{line.sku}</span></td><td className="py-2 text-right">{line.quantity}</td><td className="py-2 text-right">{formatter.format(line.unitPrice)}</td><td className="py-2 text-right">{formatter.format(line.lineTotal)}</td></tr>)}</tbody></table>
      <dl className="ml-auto mt-4 max-w-64 space-y-1 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatter.format(receipt.subtotal)}</dd></div><div className="flex justify-between"><dt>Discount ({receipt.discountPercent}%)</dt><dd>−{formatter.format(receipt.discountAmount)}</dd></div><div className="flex justify-between border-t border-black pt-2 text-base font-bold"><dt>Total</dt><dd>{formatter.format(receipt.total)}</dd></div></dl>
      <section className="mt-5 border-t border-black pt-3 text-sm"><p className="mb-2 font-semibold">Payment</p>{receipt.tenders.map((tender) => <p key={`${receipt.saleId}-${tender.method}`} className="flex justify-between"><span>{tenderMethods.find(({ id }) => id === tender.method)?.label || tender.method}</span><span>{formatter.format(tender.amount)}</span></p>)}</section>
      {receipt.providerSettlements.length > 0 && <section className="mt-4 border-t border-black pt-3 text-sm"><p className="mb-2 font-semibold">Provider commission (store record)</p>{receipt.providerSettlements.map((settlement) => <div key={`${receipt.saleId}-${settlement.provider}`}><p className="flex justify-between"><span>{settlement.provider === 'uber' ? 'Uber' : 'PickMe'} commission ({settlement.commissionRate}%)</span><span>{formatter.format(settlement.commissionAmount)}</span></p><p className="flex justify-between"><span>Estimated payout</span><span>{formatter.format(settlement.netSettlement)}</span></p></div>)}</section>}
      <footer className="mt-8 border-t border-black pt-4 text-center text-xs"><p>Thank you for shopping with us.</p><p className="mt-2">This is a sales receipt, not a tax invoice.</p></footer>
    </section>}
  </>;
}
