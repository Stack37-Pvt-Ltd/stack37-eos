export default function RegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b p-4">
        <h1 className="text-xl font-bold">My Business by STACK37 | Registration</h1>
      </header>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
