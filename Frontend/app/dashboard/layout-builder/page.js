'use client';

import useAuth from '@/lib/useAuth';
import LayoutDesigner from '../purchases/_components/LayoutDesigner';

export default function GlobalLayoutBuilderPage() {
  useAuth();
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <LayoutDesigner />
    </div>
  );
}
