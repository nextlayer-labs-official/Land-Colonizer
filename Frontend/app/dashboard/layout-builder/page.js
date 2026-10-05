'use client';

import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import LayoutDesigner from '../purchases/_components/LayoutDesigner';

export default function GlobalLayoutBuilderPage() {
  useAuth();
  const { can, loading } = usePermissions();

  if (loading) return null;
  if (!can('LAYOUT_VIEW')) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        You don&apos;t have permission to view the Layout Builder.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <LayoutDesigner
        canEdit={can('LAYOUT_EDIT')}
        canCreateLayout={can('LAYOUT_CREATE')}
        canDeleteLayout={can('LAYOUT_DELETE')}
      />
    </div>
  );
}
