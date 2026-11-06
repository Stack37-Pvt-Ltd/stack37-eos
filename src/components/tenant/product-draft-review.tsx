'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '../../lib/supabase/client';

const PAGE_SIZE = 20;

const REVIEW_FLAGS = [
  'MISSING_BARCODE',
  'INVALID_BARCODE',
  'DUPLICATE_BARCODE',
  'SUGGESTED_NAME_BARCODE_SWAP',
  'NAME_REVIEW',
  'CATEGORY_REVIEW',
  'RETAIL_BELOW_WHOLESALE',
  'SOURCE_QUANTITY_IGNORED',
  'PRICE_REVIEW',
] as const;

const FLAG_LABELS: Record<(typeof REVIEW_FLAGS)[number], string> = {
  MISSING_BARCODE: 'Missing barcode',
  INVALID_BARCODE: 'Invalid barcode',
  DUPLICATE_BARCODE: 'Duplicate barcode',
  SUGGESTED_NAME_BARCODE_SWAP: 'Possible name/barcode swap',
  NAME_REVIEW: 'Check product name',
  CATEGORY_REVIEW: 'Check category',
  RETAIL_BELOW_WHOLESALE: 'Retail price below wholesale',
  SOURCE_QUANTITY_IGNORED: 'Source quantity ignored',
  PRICE_REVIEW: 'Check price',
};

type DraftStatus = 'staged' | 'reviewed' | 'resolved' | 'published' | 'rejected';

type ProductDraft = {
  id: string;
  organization_id: string;
  source_file: string;
  source_id: number;
  source_raw: Record<string, unknown>;
  name: string;
  barcode: string | null;
  source_category: string | null;
  company_name: string | null;
  wholesale_price: number | string | null;
  retail_price: number | string | null;
  sku: string | null;
  review_flags: string[];
  status: DraftStatus;
  resolution_notes: string | null;
  updated_at: string;
};

type DraftSummary = {
  total_staged: number;
  by_status: Record<string, number>;
  flagged_total: number;
  by_flag: Record<string, number>;
};

type DraftForm = {
  name: string;
  barcode: string;
  source_category: string;
  company_name: string;
  sku: string;
  wholesale_price: string;
  retail_price: string;
  status: Exclude<DraftStatus, 'published'>;
  resolution_notes: string;
};

const EMPTY_FORM: DraftForm = {
  name: '',
  barcode: '',
  source_category: '',
  company_name: '',
  sku: '',
  wholesale_price: '',
  retail_price: '',
  status: 'staged',
  resolution_notes: '',
};

function toForm(draft: ProductDraft): DraftForm {
  return {
    name: draft.name,
    barcode: draft.barcode ?? '',
    source_category: draft.source_category ?? '',
    company_name: draft.company_name ?? '',
    sku: draft.sku ?? '',
    wholesale_price: draft.wholesale_price == null ? '' : String(draft.wholesale_price),
    retail_price: draft.retail_price == null ? '' : String(draft.retail_price),
    status: draft.status === 'published' ? 'resolved' : draft.status,
    resolution_notes: draft.resolution_notes ?? '',
  };
}

function formatLkr(value: number | string | null) {
  if (value == null || value === '') return 'Not set';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return `LKR ${new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed)}`;
}

function parsePrice(value: string, label: string): { value: string | null; error?: string } {
  const normalized = value.trim();
  if (!normalized) return { value: null };
  if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(normalized)) {
    return { value: null, error: `${label} must be a non-negative amount with up to two decimal places.` };
  }
  return { value: normalized };
}

function statusLabel(status: DraftStatus) {
  switch (status) {
    case 'staged': return 'Needs review';
    case 'reviewed': return 'Reviewed';
    case 'resolved': return 'Resolved';
    case 'rejected': return 'Rejected';
    case 'published': return 'Published';
  }
}

function labelForFlag(flag: string) {
  return flag in FLAG_LABELS ? FLAG_LABELS[flag as keyof typeof FLAG_LABELS] : flag.replaceAll('_', ' ').toLowerCase();
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  step,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
      />
      {hint && <p className="text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

export function ProductDraftReview({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [drafts, setDrafts] = useState<ProductDraft[]>([]);
  const [summary, setSummary] = useState<DraftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('staged');
  const [flagFilter, setFlagFilter] = useState('all');
  const [searchMode, setSearchMode] = useState<'name' | 'barcode' | 'source_id'>('name');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadDrafts() {
      setLoading(true);
      setLoadError(null);
      const supabase = createClient();
      let query = supabase
        .from('product_drafts')
        .select('id, organization_id, source_file, source_id, source_raw, name, barcode, source_category, company_name, wholesale_price, retail_price, sku, review_flags, status, resolution_notes, updated_at', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('source_id', { ascending: true });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (flagFilter !== 'all') query = query.contains('review_flags', [flagFilter]);
      if (search) {
        if (searchMode === 'source_id') {
          const sourceId = Number.parseInt(search, 10);
          if (!Number.isInteger(sourceId) || String(sourceId) !== search.trim()) {
            setDrafts([]);
            setRowCount(0);
            setLoading(false);
            return;
          }
          query = query.eq('source_id', sourceId);
        } else if (searchMode === 'barcode') {
          query = query.ilike('barcode', `%${search}%`);
        } else {
          query = query.ilike('name', `%${search}%`);
        }
      }

      const [rowsResult, summaryResult] = await Promise.all([
        query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
        supabase.rpc('get_product_draft_summary', { p_organization_id: organizationId }),
      ]);

      if (!active) return;
      if (rowsResult.error) {
        setLoadError(rowsResult.error.message);
        setDrafts([]);
        setRowCount(0);
      } else {
        setDrafts((rowsResult.data ?? []) as ProductDraft[]);
        setRowCount(rowsResult.count ?? 0);
      }
      if (!summaryResult.error && summaryResult.data) {
        setSummary(summaryResult.data as DraftSummary);
      } else {
        setSummary(null);
      }
      setLoading(false);
    }

    void loadDrafts();
    return () => { active = false; };
  }, [organizationId, page, statusFilter, flagFilter, search, searchMode, refreshKey]);

  function updateForm<FieldName extends keyof DraftForm>(field: FieldName, value: DraftForm[FieldName]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEditing(draft: ProductDraft) {
    setEditingId(draft.id);
    setForm(toForm(draft));
    setSaveError(null);
    setSaveMessage(null);
  }

  function changeFilter(update: () => void) {
    setPage(0);
    setSaveMessage(null);
    update();
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
    setSaveMessage(null);
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>, draft: ProductDraft) {
    event.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    const name = form.name.trim();
    if (!name) {
      setSaveError('Enter a product name before saving.');
      return;
    }
    const wholesale = parsePrice(form.wholesale_price, 'Wholesale price');
    const retail = parsePrice(form.retail_price, 'Retail price');
    if (wholesale.error || retail.error) {
      setSaveError(wholesale.error ?? retail.error ?? 'Check the price values.');
      return;
    }

    setSavingId(draft.id);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('resolve_product_draft', {
      p_organization_id: organizationId,
      p_draft_id: draft.id,
      p_updates: {
        name,
        barcode: form.barcode.trim() || null,
        source_category: form.source_category.trim() || null,
        company_name: form.company_name.trim() || null,
        sku: form.sku.trim() || null,
        wholesale_price: wholesale.value,
        retail_price: retail.value,
        status: form.status,
        resolution_notes: form.resolution_notes.trim(),
      },
    });
    setSavingId(null);

    if (error) {
      setSaveError(error.message);
      return;
    }
    if (!data?.success) {
      setSaveError('The draft was not saved. Refresh the page and try again.');
      return;
    }

    setEditingId(null);
    setSaveMessage(`Source item ${draft.source_id} saved as ${statusLabel(form.status).toLowerCase()}.`);
    setRefreshKey((current) => current + 1);
  }

  const totalPages = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  const recordTotal = summary?.total_staged ?? 0;
  const flaggedTotal = summary?.flagged_total ?? 0;

  return (
    <section className="max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="eyebrow">Inventory · Import review</p>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">Review product drafts</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Check the imported values for {organizationName}. Edits are saved to the draft and recorded in the audit log. This page does not publish products or create stock.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Draft records</p>
          <p className="mt-1 text-2xl font-semibold text-brand-navy">{recordTotal.toLocaleString()}</p>
        </div>
        <div className="border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm text-slate-700">Rows with review flags</p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">{flaggedTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-brand-navy">Find items to review</h2>
        {summary && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Review flag totals">
            {REVIEW_FLAGS.filter((flag) => (summary.by_flag?.[flag] ?? 0) > 0).map((flag) => (
              <button
                type="button"
                key={flag}
                onClick={() => changeFilter(() => setFlagFilter(flagFilter === flag ? 'all' : flag))}
                aria-pressed={flagFilter === flag}
                className={`min-h-9 border px-2.5 text-left text-xs ${flagFilter === flag ? 'border-brand-blue bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-700 hover:border-slate-400'}`}
              >
                {labelForFlag(flag)} <span className="font-semibold">{summary.by_flag[flag]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.75fr)_minmax(10rem,0.75fr)]">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-800">Status</span>
            <select value={statusFilter} onChange={(event) => changeFilter(() => setStatusFilter(event.target.value))} className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm">
              <option value="staged">Needs review</option>
              <option value="reviewed">Reviewed</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All statuses</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-800">Search by</span>
            <select value={searchMode} onChange={(event) => changeFilter(() => setSearchMode(event.target.value as typeof searchMode))} className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm">
              <option value="name">Product name</option>
              <option value="barcode">Barcode</option>
              <option value="source_id">Source ID</option>
            </select>
          </label>
          <form onSubmit={submitSearch} className="space-y-1.5">
            <label htmlFor="draft-search" className="block text-sm font-medium text-slate-800">Search value</label>
            <div className="flex gap-2">
              <input id="draft-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="min-h-11 min-w-0 flex-1 border border-slate-300 px-3 text-sm" placeholder={searchMode === 'barcode' ? 'Barcode' : searchMode === 'source_id' ? 'Source ID' : 'Product name'} />
              <button type="submit" className="min-h-11 border border-brand-navy px-4 text-sm font-medium text-brand-navy hover:bg-slate-50">Search</button>
            </div>
          </form>
        </div>
        {flagFilter !== 'all' && (
          <button type="button" onClick={() => changeFilter(() => setFlagFilter('all'))} className="mt-3 text-sm font-medium text-brand-blue hover:underline">
            Clear flag filter: {labelForFlag(flagFilter)}
          </button>
        )}
      </div>

      {saveMessage && <p role="status" className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{saveMessage}</p>}
      {loadError && <p role="alert" className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">Could not load drafts: {loadError}</p>}
      {loading && <p role="status" className="text-sm text-slate-600">Loading product drafts…</p>}
      {!loading && !loadError && drafts.length === 0 && (
        <div className="border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No drafts match these filters. Try another status or clear the flag/search filters.
        </div>
      )}

      {!loading && drafts.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <p>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rowCount)} of {rowCount.toLocaleString()} matching drafts</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} className="min-h-10 border border-slate-300 px-3 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
              <span>Page {page + 1} of {totalPages}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page + 1 >= totalPages} className="min-h-10 border border-slate-300 px-3 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
            </div>
          </div>

          {drafts.map((draft) => (
            <article key={draft.id} className="border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Source item {draft.source_id} · {draft.source_file}</p>
                  <h2 className="mt-1 break-words text-lg font-semibold text-brand-navy">{draft.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">Barcode: {draft.barcode || 'Not set'} <span className="mx-1 text-slate-300">·</span> SKU: {draft.sku || 'Not set'}</p>
                </div>
                <span className={`inline-flex min-h-8 items-center border px-2.5 text-xs font-medium ${draft.status === 'resolved' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : draft.status === 'rejected' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                  {statusLabel(draft.status)}
                </span>
              </div>

              {draft.review_flags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {draft.review_flags.map((flag) => <span key={flag} className="border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-950">{labelForFlag(flag)}</span>)}
                </div>
              ) : <p className="mt-3 text-xs text-slate-500">No source review flags.</p>}

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p><span className="block text-xs text-slate-500">Category</span><span className="text-slate-800">{draft.source_category || 'Not set'}</span></p>
                <p><span className="block text-xs text-slate-500">Company</span><span className="text-slate-800">{draft.company_name || 'Not set'}</span></p>
                <p><span className="block text-xs text-slate-500">Wholesale</span><span className="text-slate-800">{formatLkr(draft.wholesale_price)}</span></p>
                <p><span className="block text-xs text-slate-500">Retail</span><span className="text-slate-800">{formatLkr(draft.retail_price)}</span></p>
              </div>

              <details className="mt-4 border-t border-slate-100 pt-3">
                <summary className="cursor-pointer text-sm font-medium text-brand-blue">View original source values</summary>
                <p className="mt-2 text-xs text-slate-600">Original values are preserved for comparison. Quantity here is source data only; it does not set opening stock.</p>
                <pre className="mt-2 max-h-64 overflow-auto bg-slate-50 p-3 text-xs leading-5 text-slate-700">{JSON.stringify(draft.source_raw, null, 2)}</pre>
              </details>

              {draft.status !== 'published' && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {editingId === draft.id ? (
                    <form onSubmit={(event) => void saveDraft(event, draft)} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Field id={`draft-name-${draft.id}`} label="Product name" value={form.name} onChange={(value) => updateForm('name', value)} />
                        <Field id={`draft-barcode-${draft.id}`} label="Barcode" value={form.barcode} onChange={(value) => updateForm('barcode', value)} hint="Leave blank if unknown." />
                        <Field id={`draft-sku-${draft.id}`} label="SKU" value={form.sku} onChange={(value) => updateForm('sku', value)} hint="Optional; publishing is not available here." />
                        <Field id={`draft-category-${draft.id}`} label="Source category" value={form.source_category} onChange={(value) => updateForm('source_category', value)} />
                        <Field id={`draft-company-${draft.id}`} label="Company / brand" value={form.company_name} onChange={(value) => updateForm('company_name', value)} />
                        <Field id={`draft-wholesale-${draft.id}`} label="Wholesale price (LKR)" type="number" step="0.01" value={form.wholesale_price} onChange={(value) => updateForm('wholesale_price', value)} hint="Non-negative; up to 2 decimal places." />
                        <Field id={`draft-retail-${draft.id}`} label="Retail price (LKR)" type="number" step="0.01" value={form.retail_price} onChange={(value) => updateForm('retail_price', value)} hint="Non-negative; up to 2 decimal places." />
                        <label className="space-y-1.5">
                          <span className="block text-sm font-medium text-slate-800">Review outcome</span>
                          <select value={form.status} onChange={(event) => updateForm('status', event.target.value as DraftForm['status'])} className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm">
                            <option value="staged">Keep in review queue</option>
                            <option value="reviewed">Reviewed, still needs follow-up</option>
                            <option value="resolved">Mark resolved</option>
                            <option value="rejected">Reject this draft</option>
                          </select>
                        </label>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor={`draft-notes-${draft.id}`} className="block text-sm font-medium text-slate-800">Review notes</label>
                        <textarea id={`draft-notes-${draft.id}`} rows={3} value={form.resolution_notes} onChange={(event) => updateForm('resolution_notes', event.target.value)} className="w-full border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" placeholder="Record why you changed or accepted these values." />
                      </div>
                      <p className="text-xs leading-5 text-slate-500">Choosing “Resolved” records your decision; it does not remove the original flags or publish the product. Quantity is not editable in this review workflow.</p>
                      {saveError && <p role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">Could not save: {saveError}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={savingId === draft.id} className="min-h-11 bg-brand-navy px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">{savingId === draft.id ? 'Saving…' : 'Save draft changes'}</button>
                        <button type="button" disabled={savingId === draft.id} onClick={() => { setEditingId(null); setSaveError(null); }} className="min-h-11 border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button type="button" onClick={() => startEditing(draft)} className="min-h-11 border border-brand-navy px-4 text-sm font-medium text-brand-navy hover:bg-slate-50">Edit draft fields</button>
                  )}
                </div>
              )}
            </article>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600">
            <p>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rowCount)} of {rowCount.toLocaleString()} matching drafts</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} className="min-h-10 border border-slate-300 px-3 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
              <span>Page {page + 1} of {totalPages}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page + 1 >= totalPages} className="min-h-10 border border-slate-300 px-3 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
