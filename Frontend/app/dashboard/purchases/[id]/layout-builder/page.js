'use client';

import { useParams } from 'next/navigation';
import useAuth from '@/lib/useAuth';
import LayoutDesigner from '../../_components/LayoutDesigner';

export default function LayoutBuilderPage() {
  useAuth();
  const { id } = useParams();

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#1e1e1e' }}>
      <LayoutDesigner purchaseId={Number(id)} />
    </div>
  );
}
