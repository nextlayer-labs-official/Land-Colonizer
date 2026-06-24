'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlotsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/purchases'); }, [router]);
  return null;
}
