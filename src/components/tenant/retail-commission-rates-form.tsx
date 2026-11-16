'use client';

import * as React from 'react';
import { updateRetailCommissionRatesAction } from '../../lib/actions/retail';
import { Button } from '../ui/button';

export function RetailCommissionRatesForm({ organizationId, canEdit, uberRate, pickmeRate }: {
  organizationId: string;
  canEdit: boolean;
  uberRate: number | null;
  pickmeRate: number | null;
}) {
  const [uber, setUber] = React.useState(uberRate == null ? '' : String(uberRate));
  const [pickme, setPickme] = React.useState(pickmeRate == null ? '' : String(pickmeRate));
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await updateRetailCommissionRatesAction({ organizationId, uberCommissionRate: uber, pickmeCommissionRate: pickme });
      setMessage(result.success
        ? { kind: 'success', text: 'Provider rates saved.' }
        : { kind: 'error', text: result.error || 'Provider rates could not be saved.' });
    } catch {
      setMessage({ kind: 'error', text: 'Provider rates could not be saved. Refresh Settings and try again.' });
    } finally {
      setBusy(false);
    }
  }

  return <form id="settings-panel" onSubmit={save} className="settings-form max-w-3xl space-y-6" aria-busy={busy}>
    {!canEdit && <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Only the Primary Owner can change these rates.</div>}
    <div className="settings-panel space-y-5">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-base font-bold text-slate-900">Uber and PickMe commission rates</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">Enter the current percentage from each provider’s merchant agreement. These rates are left blank until you set them.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium text-slate-700">Uber commission (%)
          <div className="relative"><input type="number" min="0" max="100" step="0.01" value={uber} onChange={(event) => setUber(event.target.value)} placeholder="Not set" disabled={!canEdit || busy} className="min-h-11 w-full border border-slate-300 bg-white px-3 pr-9 text-base disabled:bg-slate-50" /><span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span></div>
        </label>
        <label className="space-y-1.5 text-sm font-medium text-slate-700">PickMe commission (%)
          <div className="relative"><input type="number" min="0" max="100" step="0.01" value={pickme} onChange={(event) => setPickme(event.target.value)} placeholder="Not set" disabled={!canEdit || busy} className="min-h-11 w-full border border-slate-300 bg-white px-3 pr-9 text-base disabled:bg-slate-50" /><span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span></div>
        </label>
      </div>
      <p className="text-xs leading-5 text-slate-600">Example only: a 10% commission on a 1,000 provider order is 100, leaving an estimated 900 payout. This does not add a fee to the customer’s bill or change your product prices.</p>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'text-sm text-rose-700' : 'text-sm text-emerald-800'}>{message.text}</p>}
      {canEdit && <div className="flex justify-end"><Button type="submit" disabled={busy} isLoading={busy}>Save provider rates</Button></div>}
    </div>
  </form>;
}
