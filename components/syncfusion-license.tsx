'use client';

import { useEffect } from 'react';
import { registerLicense } from '@syncfusion/ej2-base';

/**
 * Registrasi license Syncfusion (sekali saat mount).
 * Set license key di .env.local:
 *   NEXT_PUBLIC_SYNCFUSION_LICENSE=your-license-key-here
 * Jangan commit file .env.local ke repo.
 */
export function SyncfusionLicenseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE;
    if (key && typeof key === 'string' && key.trim() !== '') {
      registerLicense(key.trim());
    }
  }, []);

  return <>{children}</>;
}
