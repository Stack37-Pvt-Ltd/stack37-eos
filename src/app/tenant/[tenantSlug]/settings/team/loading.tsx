export default function TeamSettingsLoading() {
  return (
    <section aria-label="Loading Team Management" role="status" className="min-w-0 space-y-6">
      <p className="eyebrow">People & access</p>
      <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">Loading Team</h1>
      <p className="text-sm text-slate-600">Loading workspace members and invitations.</p>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-24 border border-brand-line bg-white" />
        <div className="h-64 border border-brand-line bg-white" />
        <div className="h-40 border border-brand-line bg-white" />
      </div>
    </section>
  );
}
