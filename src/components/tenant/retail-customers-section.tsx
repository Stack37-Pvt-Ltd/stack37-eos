'use client';

import * as React from 'react';
import { searchRetailCustomersAction, upsertRetailCustomerAction, type RetailCustomer } from '../../lib/actions/retail';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';

function purchaseDate(value: string | null) {
  if (!value) return 'No recorded purchase';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

export function RetailCustomersSection({ organizationId, canRead, canManage, writesEnabled }: {
  organizationId: string;
  canRead: boolean;
  canManage: boolean;
  writesEnabled: boolean;
}) {
  const [customers, setCustomers] = React.useState<RetailCustomer[]>([]);
  const [query, setQuery] = React.useState('');
  const [name, setName] = React.useState('');
  const [editingCustomer, setEditingCustomer] = React.useState<RetailCustomer | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const searchSequence = React.useRef(0);

  const loadCustomers = React.useCallback(async (search: string) => {
    if (!canRead) return;
    const sequence = ++searchSequence.current;
    try {
      const result = await searchRetailCustomersAction({ organizationId, query: search, limit: 100 });
      if (sequence !== searchSequence.current) return;
      if (!result.success || !result.data) {
        setError(result.error || 'Customer records could not be loaded.');
        return;
      }
      setError(null);
      setCustomers(result.data);
    } catch {
      if (sequence === searchSequence.current) setError('Customer records could not be loaded. Refresh and try again.');
    }
  }, [canRead, organizationId]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => { void loadCustomers(query); }, 200);
    return () => window.clearTimeout(timer);
  }, [loadCustomers, query]);

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !writesEnabled || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await upsertRetailCustomerAction({ organizationId, customerId: editingCustomer?.id, name });
      if (!result.success || !result.data) {
        setError(result.error || 'The customer could not be saved.');
        return;
      }
      setName('');
      setEditingCustomer(null);
      setNotice(editingCustomer ? 'Customer updated.' : 'Customer added.');
      await loadCustomers(query);
    } catch {
      setError('The customer could not be saved. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!canRead) {
    return <section aria-labelledby="retail-customers-title" className="space-y-5">
      <div><p className="eyebrow mb-2">Retail &amp; E-Commerce operations</p><h2 id="retail-customers-title" className="text-2xl font-semibold tracking-tight text-brand-navy">Customers</h2></div>
      <Alert variant="warning" title="Customer access is not assigned">Ask a workspace administrator to grant customer access to your role.</Alert>
    </section>;
  }

  return <section aria-labelledby="retail-customers-title" className="min-w-0 space-y-5">
    <div><p className="eyebrow mb-2">Retail &amp; E-Commerce operations</p><h2 id="retail-customers-title" className="text-2xl font-semibold tracking-tight text-brand-navy">Customers</h2><p className="mt-2 text-sm text-slate-600">Customer names are linked to completed receipts. Purchase history reflects branches assigned to your account.</p></div>
    {canManage && writesEnabled && <form onSubmit={saveCustomer} className="flex flex-col gap-3 border border-brand-line bg-white p-4 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 space-y-1 text-sm font-medium text-slate-700">{editingCustomer ? 'Customer name' : 'New customer'}<input required minLength={1} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} className="min-h-11 w-full border border-slate-300 px-3" placeholder="Enter a customer name" /></label>
      <div className="flex gap-2"><Button type="submit" disabled={!name.trim() || busy} isLoading={busy}>{editingCustomer ? 'Save changes' : 'Add customer'}</Button>{editingCustomer && <Button type="button" variant="outline" onClick={() => { setEditingCustomer(null); setName(''); }}>Cancel</Button>}</div>
    </form>}
    {canManage && !writesEnabled && <Alert variant="info" title="Preview changes are read-only">Customer records can be reviewed in Preview, but saving changes is disabled to protect shared live business data.</Alert>}
    {!canManage && <Alert variant="info" title="View-only customer access">Your role can search customer records but cannot add or change them.</Alert>}
    {error && <Alert variant="error" title="Customer information unavailable">{error}</Alert>}
    {notice && <Alert variant="success" title="Saved">{notice}</Alert>}
    <div className="max-w-full overflow-x-auto border border-brand-line bg-white">
      <div className="border-b border-brand-line p-4"><label className="block max-w-md space-y-1 text-sm text-slate-600"><span>Search customers</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full min-w-0 border border-brand-line px-3" placeholder="Search by customer name" /></label></div>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600"><tr><th scope="col" className="px-4 py-3 font-medium">Customer</th><th scope="col" className="px-4 py-3 font-medium">Latest visible purchase</th><th scope="col" className="px-4 py-3 font-medium">Added</th>{canManage && <th scope="col" className="px-4 py-3 font-medium">Action</th>}</tr></thead>
        <tbody>{customers.map((customer) => <tr key={customer.id} className="border-t border-brand-line"><td className="px-4 py-3 font-medium text-brand-navy">{customer.name}</td><td className="px-4 py-3 text-slate-600">{purchaseDate(customer.lastPurchaseAt)}</td><td className="px-4 py-3 text-slate-600">{purchaseDate(customer.createdAt)}</td>{canManage && <td className="px-4 py-3"><Button type="button" variant="outline" size="sm" disabled={!writesEnabled || busy} onClick={() => { setEditingCustomer(customer); setName(customer.name); setNotice(null); }}>Edit</Button></td>}</tr>)}
        {!customers.length && <tr><td colSpan={canManage ? 4 : 3} className="px-4 py-9 text-center text-sm text-slate-600">{error ? 'Customer records could not be loaded.' : query ? 'No customers match your search.' : 'No customers have been added yet.'}</td></tr>}</tbody>
      </table>
    </div>
  </section>;
}
