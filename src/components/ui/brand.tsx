import Image from 'next/image';
import Link from 'next/link';

export function Brand({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} aria-label="My Business by STACK37" className="inline-flex shrink-0 py-2">
      <Image src="/stack37-logo.webp" alt="STACK37" width={584} height={110} priority
        className={`h-auto ${compact ? 'w-[128px] sm:w-[154px]' : 'w-[166px] sm:w-[190px]'}`} />
    </Link>
  );
}
