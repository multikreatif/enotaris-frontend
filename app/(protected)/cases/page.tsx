'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirect /cases ke Berkas Akta Notaris (menu terpisah Notaris vs PPAT). */
export default function CasesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/cases/notaris');
  }, [router]);
  return null;
}
