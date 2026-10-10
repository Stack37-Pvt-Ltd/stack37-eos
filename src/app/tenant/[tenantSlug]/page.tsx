export default async function TenantPage(
  props: {
    params: Promise<{ tenantSlug: string }>;
  }
) {
  const params = await props.params;
  return (
    <div className="bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-bold mb-2">Welcome to {params.tenantSlug}</h1>
      <p className="text-gray-600">This is a protected tenant workspace.</p>
    </div>
  );
}
