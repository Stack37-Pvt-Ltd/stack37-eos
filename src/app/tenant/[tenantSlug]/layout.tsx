export default async function TenantLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ tenantSlug: string }>;
  }
) {
  const params = await props.params;
  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-slate-900 text-white p-4">
        <h2 className="font-bold text-lg mb-4 truncate">{params.tenantSlug} Workspace</h2>
        <nav>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>Dashboard</li>
            <li>Modules</li>
            <li>Settings</li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        {props.children}
      </main>
    </div>
  );
}
