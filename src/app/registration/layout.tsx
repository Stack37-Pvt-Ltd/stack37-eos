import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register Business — My Business by STACK37',
  description: 'Register your business organization and establish your enterprise workspace.',
};

export default function RegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
