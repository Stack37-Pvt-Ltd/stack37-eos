import { describe, expect, it } from 'vitest';
import {
  addScannedProduct,
  calculateDiscountedTotal,
  calculateProviderCommission,
  findProductByBarcode,
  MAX_CASHIER_DISCOUNT_PERCENT,
  normalizeCustomerPhone,
  sumTenderAmounts,
} from '../../src/lib/retail/checkout';

describe('retail checkout helpers', () => {
  const products = [
    { id: 'milk', barcode: ' 048123456789 ', quantity: 4 },
    { id: 'bread', barcode: null, quantity: 2 },
  ];

  it('matches scanner input against a complete barcode, ignoring surrounding whitespace', () => {
    expect(findProductByBarcode(products, ' 048123456789\n')?.id).toBe('milk');
    expect(findProductByBarcode(products, '04812345678')).toBeNull();
    expect(findProductByBarcode(products, '')).toBeNull();
  });

  it('increments repeated scans and prevents adding more than available stock', () => {
    expect(addScannedProduct({}, products[0])).toEqual({ basket: { milk: 1 }, added: true });
    expect(addScannedProduct({ milk: 4 }, products[0])).toEqual({ basket: { milk: 4 }, added: false, reason: 'unavailable' });
    expect(addScannedProduct({}, { id: 'empty', barcode: '1', quantity: 0 })).toEqual({ basket: {}, added: false, reason: 'out_of_stock' });
  });

  it('calculates a cent-rounded order discount and never caps above the cashier policy', () => {
    expect(calculateDiscountedTotal(100.01, 12.5)).toEqual({ discountAmount: 12.5, total: 87.51 });
    expect(calculateDiscountedTotal(100, 99).total).toBe(80);
    expect(MAX_CASHIER_DISCOUNT_PERCENT).toBe(20);
  });

  it('sums split tenders in minor currency units', () => {
    expect(sumTenderAmounts([{ amount: '12.34' }, { amount: 2.66 }])).toBe(15);
    expect(sumTenderAmounts([{ amount: '0.10' }, { amount: '0.20' }])).toBe(0.3);
  });

  it('calculates commission from only the amount paid through a delivery provider', () => {
    expect(calculateProviderCommission(1000, 12.5)).toEqual({ commission: 125, netSettlement: 875 });
    expect(calculateProviderCommission(1.25, 12.5)).toEqual({ commission: 0.16, netSettlement: 1.09 });
    expect(calculateProviderCommission(1000, null)).toBeNull();
  });

  it('normalizes common phone punctuation while retaining an optional country prefix', () => {
    expect(normalizeCustomerPhone(' +94 (77) 123-4567 ')).toBe('+94771234567');
    expect(normalizeCustomerPhone('077 123 4567')).toBe('0771234567');
    expect(normalizeCustomerPhone('abc')).toBe('');
  });
});
