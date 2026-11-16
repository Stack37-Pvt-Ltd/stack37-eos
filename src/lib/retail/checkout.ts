export const MAX_CASHIER_DISCOUNT_PERCENT = 20;

export type BarcodeProduct = {
  id: string;
  barcode: string | null;
  quantity: number;
};

export type RetailTenderMethod = 'cash' | 'card' | 'uber' | 'pickme';

export function findProductByBarcode<T extends BarcodeProduct>(products: readonly T[], scannedValue: string): T | null {
  const barcode = scannedValue.trim().toLocaleLowerCase();
  if (!barcode) return null;
  return products.find((product) => product.barcode?.trim().toLocaleLowerCase() === barcode) || null;
}

export function addScannedProduct<T extends BarcodeProduct>(
  basket: Record<string, number>,
  product: T,
): { basket: Record<string, number>; added: boolean; reason?: 'unavailable' | 'out_of_stock' } {
  if (product.quantity <= 0) return { basket, added: false, reason: 'out_of_stock' };
  if ((basket[product.id] || 0) + 1 > product.quantity) return { basket, added: false, reason: 'unavailable' };
  return { basket: { ...basket, [product.id]: (basket[product.id] || 0) + 1 }, added: true };
}

export function toMinorUnits(value: number | string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function calculateDiscountedTotal(subtotal: number, discountPercent: number): { discountAmount: number; total: number } {
  const subtotalCents = Math.max(0, toMinorUnits(subtotal));
  const cappedPercent = Math.min(MAX_CASHIER_DISCOUNT_PERCENT, Math.max(0, Number.isFinite(discountPercent) ? discountPercent : 0));
  const discountCents = Math.round(subtotalCents * cappedPercent / 100);
  return { discountAmount: discountCents / 100, total: (subtotalCents - discountCents) / 100 };
}

export function sumTenderAmounts(tenders: ReadonlyArray<{ amount: number | string }>): number {
  return tenders.reduce((total, tender) => total + toMinorUnits(tender.amount), 0) / 100;
}

export function calculateProviderCommission(amount: number | string, ratePercent: number | null): { commission: number; netSettlement: number } | null {
  if (ratePercent === null || !Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) return null;
  const amountCents = Math.max(0, toMinorUnits(amount));
  const commissionCents = Math.round(amountCents * ratePercent / 100);
  return { commission: commissionCents / 100, netSettlement: (amountCents - commissionCents) / 100 };
}

export function normalizeCustomerPhone(phone: string): string {
  const trimmed = phone.trim();
  const compact = trimmed.replace(/[\s().-]/g, '');
  if (!/^\+?\d{7,15}$/.test(compact)) return '';
  return compact;
}
