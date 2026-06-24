'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function NewInventoryRedirect() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const pid          = searchParams.get('purchase_id');

  useEffect(() => {
    if (pid) router.replace(`/dashboard/purchases/${pid}`);
    else     router.replace('/dashboard/inventory');
  }, []);

  return null;
}
