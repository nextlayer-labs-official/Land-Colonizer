'use client';

import { useEffect, useState } from 'react';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { TableSkeleton } from '@/components/Skeleton';

// ── Create Role Modal ─────────────────────────────────────────────────────────
function CreateRoleModal({ onClose, onCreated }) {
  const [form, setForm]       = useState({ name: '', slug: '', description: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev, [name]: value,
      ...(name === 'name' ? { slug: value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') } : {}),
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { const r = await apiPost('/roles', form); onCreated(r); onClose(); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">New Role</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <div className="px-3 py-2.5 rounded bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Role Name <span className="text-red-400">*</span></label>
            <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Account Manager" className="ams-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Slug <span className="text-red-400">*</span></label>
            <input name="slug" value={form.slug} onChange={handleChange} required placeholder="e.g. account-manager" className="ams-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Description <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <input name="description" value={form.description} onChange={handleChange} placeholder="Brief description" className="ams-input" />
          </div>
          <div className="flex gap-3 pt-1 pb-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center py-2">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2">
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Role Modal ─────────────────────────────────────────────────────────
function DeleteRoleModal({ role, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleDelete = async () => {
    setLoading(true);
    try { await apiDelete(`/roles/${role.id}`); onDeleted(role.id); onClose(); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-xl p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Delete Role</h2>
        <p className="text-sm text-gray-500 mb-4">
          Delete <span className="font-medium text-gray-700">{role.name}</span>? This cannot be undone.
        </p>
        {error && <div className="px-3 py-2.5 rounded bg-red-50 border border-red-200 text-red-600 text-sm mb-3">{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center py-2">Cancel</button>
          <button onClick={handleDelete} disabled={loading} className="btn-danger flex-1 justify-center py-2">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Permission Matrix Panel ───────────────────────────────────────────────────
const MODULE_ORDER = ['USER','ROLE','PURCHASE','CUSTOMER','SALE','INVENTORY','BROKER','PROJECT','SETTINGS','REPORTS','AUDIT'];
const ACTION_ORDER = ['VIEW','CREATE','EDIT','DELETE','ARCHIVE','APPROVE','FINANCE'];
const ACTION_COLORS = {
  VIEW:    { on: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  CREATE:  { on: '#dcfce7', text: '#15803d', border: '#86efac' },
  EDIT:    { on: '#fef9c3', text: '#a16207', border: '#fde047' },
  DELETE:  { on: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  ARCHIVE: { on: '#ffedd5', text: '#c2410c', border: '#fdba74' },
  APPROVE: { on: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe' },
  FINANCE: { on: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
};

function PermissionPanel({ role, onClose, canEdit }) {
  const [permissions, setPermissions] = useState(role.rolePermissions);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState('');

  const toggle = (permId) => {
    setPermissions((prev) => prev.map((rp) => rp.permission.id === permId ? { ...rp, allowed: !rp.allowed } : rp));
    setSaved(false); setError('');
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await apiPut(`/roles/${role.id}`, {
        permissions: permissions.map((rp) => ({ permission_id: rp.permission.id, allowed: rp.allowed })),
      });
      setSaved(true);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  // Build matrix: { MODULE: { ACTION: rolePermission } }
  const matrix = {};
  const actionsPresent = new Set();
  for (const rp of permissions) {
    const parts  = rp.permission.code.split('_');
    const action = parts[parts.length - 1];
    const mod    = rp.permission.module.name;
    actionsPresent.add(action);
    if (!matrix[mod]) matrix[mod] = {};
    matrix[mod][action] = rp;
  }
  const cols = ACTION_ORDER.filter(a => actionsPresent.has(a));
  const rows = MODULE_ORDER.filter(m => matrix[m]);

  // Column "select all" toggle
  const toggleCol = (action) => {
    const colPerms = rows.map(m => matrix[m]?.[action]).filter(Boolean);
    const allOn    = colPerms.every(rp => rp.allowed);
    const ids      = new Set(colPerms.map(rp => rp.permission.id));
    setPermissions(prev => prev.map(rp =>
      ids.has(rp.permission.id) ? { ...rp, allowed: !allOn } : rp
    ));
    setSaved(false);
  };

  // Row "select all" toggle
  const toggleRow = (mod) => {
    const rowPerms = Object.values(matrix[mod] || {});
    const allOn    = rowPerms.every(rp => rp.allowed);
    const ids      = new Set(rowPerms.map(rp => rp.permission.id));
    setPermissions(prev => prev.map(rp =>
      ids.has(rp.permission.id) ? { ...rp, allowed: !allOn } : rp
    ));
    setSaved(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="w-full bg-white rounded-xl shadow-2xl flex flex-col" style={{ maxWidth: 900, maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: '#714B67' }}>
              {role.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">{role.name}</h2>
              <p className="text-xs text-gray-400">
                {role.is_system ? 'System role — full access' : `${permissions.filter(rp => rp.allowed).length} of ${permissions.length} permissions granted`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition text-xl leading-none">&times;</button>
        </div>

        {role.is_system ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center px-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f3eef6' }}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#714B67' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">System Role</p>
            <p className="text-sm text-gray-400 max-w-xs">This role has unrestricted access to all modules and cannot be modified.</p>
          </div>
        ) : (
          <>
            {/* Matrix */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="sticky top-0 z-10 bg-white border-b-2 border-gray-100 shadow-sm">
                    <th className="text-left py-2.5 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Module</th>
                    {cols.map(action => {
                      const c = ACTION_COLORS[action] || {};
                      const colPerms = rows.map(m => matrix[m]?.[action]).filter(Boolean);
                      const allOn    = colPerms.length > 0 && colPerms.every(rp => rp.allowed);
                      return (
                        <th key={action} className="py-2.5 px-3 text-center min-w-[70px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: c.text || '#6b7280' }}>
                              {action.charAt(0) + action.slice(1).toLowerCase()}
                            </span>
                            {canEdit && colPerms.length > 0 && (
                              <button onClick={() => toggleCol(action)}
                                title={allOn ? `Revoke all ${action}` : `Grant all ${action}`}
                                className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                                style={allOn
                                  ? { backgroundColor: c.on, borderColor: c.border }
                                  : { backgroundColor: '#f9fafb', borderColor: '#d1d5db' }}>
                                {allOn && <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: c.text }}><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((mod, ri) => {
                    const rowPerms = Object.values(matrix[mod] || {});
                    const rowAllOn = rowPerms.length > 0 && rowPerms.every(rp => rp.allowed);
                    return (
                      <tr key={mod} className={`border-b border-gray-50 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="py-2 px-6">
                          <div className="flex items-center gap-2">
                            {canEdit && (
                              <button onClick={() => toggleRow(mod)}
                                title={rowAllOn ? `Revoke all for ${mod}` : `Grant all for ${mod}`}
                                className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                                style={rowAllOn
                                  ? { backgroundColor: '#714B67', borderColor: '#714B67' }
                                  : { backgroundColor: '#f9fafb', borderColor: '#d1d5db' }}>
                                {rowAllOn && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                              </button>
                            )}
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{mod}</span>
                          </div>
                        </td>
                        {cols.map(action => {
                          const rp = matrix[mod]?.[action];
                          const c  = ACTION_COLORS[action] || {};
                          if (!rp) return (
                            <td key={action} className="py-2 px-3 text-center">
                              <span className="text-gray-200">—</span>
                            </td>
                          );
                          return (
                            <td key={action} className="py-2 px-3 text-center">
                              <button
                                onClick={() => canEdit && toggle(rp.permission.id)}
                                disabled={!canEdit}
                                className="w-7 h-7 rounded-lg border-2 flex items-center justify-center mx-auto transition-all"
                                style={rp.allowed
                                  ? { backgroundColor: c.on || '#f3f4f6', borderColor: c.border || '#d1d5db' }
                                  : { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}
                                title={`${rp.permission.code} — ${rp.allowed ? 'Allowed' : 'Denied'}`}>
                                {rp.allowed
                                  ? <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: c.text || '#374151' }}><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                  : <svg className="w-3 h-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                                }
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 shrink-0 bg-gray-50/50 rounded-b-xl">
              <div className="flex-1">
                {error && <p className="text-sm text-red-600">{error}</p>}
                {saved && !error && <p className="text-sm text-emerald-600 font-medium">Changes saved.</p>}
              </div>
              <button onClick={onClose} className="btn-secondary">Close</button>
              {canEdit && (
                <button onClick={handleSave} disabled={saving} className="btn-primary min-w-[110px]">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Bulk Delete Roles Modal ───────────────────────────────────────────────────
function BulkDeleteRolesModal({ ids, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleDelete = async () => {
    setLoading(true);
    try {
      await Promise.all(ids.map((id) => apiDelete(`/roles/${id}`)));
      onDeleted(ids);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-xl p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Delete {ids.length} role{ids.length > 1 ? 's' : ''}?</h2>
        <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
        {error && <div className="px-3 py-2.5 rounded bg-red-50 border border-red-200 text-red-600 text-sm mb-3">{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center py-2">Cancel</button>
          <button onClick={handleDelete} disabled={loading} className="btn-danger flex-1 justify-center py-2">
            {loading ? 'Deleting…' : `Delete ${ids.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Odoo-style Control Panel ──────────────────────────────────────────────────
function ControlPanel({ total, canCreate, canDelete, onNew, onBulkDelete, selectedCount }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-3 border-b border-gray-200 bg-white">
      {canCreate && (
        <button onClick={onNew}
          className="shrink-0 px-3 py-1.5 text-sm font-medium text-white rounded-sm"
          style={{ backgroundColor: '#714B67' }}>
          New
        </button>
      )}
      {canDelete && selectedCount > 0 && (
        <button onClick={onBulkDelete}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-sm bg-red-600 hover:bg-red-700 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          Delete ({selectedCount})
        </button>
      )}
      <span className="text-sm font-medium text-gray-700 shrink-0 px-1">Roles &amp; Permissions</span>
      <div className="flex-1" />
      <span className="text-sm text-gray-500 px-1">{total} roles</span>
      <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
      <div className="flex items-center gap-0.5 shrink-0">
        <button className="p-1.5 rounded" style={{ color: 'var(--ams-primary)', backgroundColor: 'var(--ams-primary-mid)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          </svg>
        </button>
        <button className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
            <rect x="1" y="1" width="6" height="6" rx="1"/>
            <rect x="9" y="1" width="6" height="6" rx="1"/>
            <rect x="1" y="9" width="6" height="6" rx="1"/>
            <rect x="9" y="9" width="6" height="6" rx="1"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RolesPage() {
  useAuth();
  const { me, can, loading: permLoading } = usePermissions();

  const [roles, setRoles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [selected, setSelected] = useState(new Set());

  const canView   = me?.is_system || can('ROLE_VIEW');
  const canCreate = me?.is_system || can('ROLE_CREATE');
  const canEdit   = me?.is_system || can('ROLE_EDIT');
  const canDelete = me?.is_system || can('ROLE_DELETE');

  useEffect(() => {
    if (permLoading) return;
    if (!canView) { setLoading(false); return; }
    apiGet('/roles').then(setRoles).catch(() => setRoles([])).finally(() => setLoading(false));
  }, [permLoading]);

  const handleCreated = (role) => setRoles((prev) => [...prev, role]);
  const handleDeleted = (id)  => setRoles((prev) => prev.filter((r) => r.id !== id));

  const toggleAll = (checked) => setSelected(checked ? new Set(roles.filter((r) => !r.is_system).map((r) => r.id)) : new Set());
  const toggleOne = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleBulkDelete = () => setModal({ type: 'bulk-delete', ids: [...selected] });

  if (permLoading || loading) return (
    <div className="bg-white rounded border border-gray-200 overflow-hidden">
      <div className="h-10 border-b border-gray-200 animate-pulse bg-gray-50" />
      <TableSkeleton cols={5} rows={5} />
    </div>
  );

  if (!canView) return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <p className="text-sm font-semibold text-gray-700 mb-1">Access Denied</p>
      <p className="text-sm text-gray-500">You don&apos;t have permission to view roles.</p>
    </div>
  );

  return (
    <div>
      <div className="bg-white rounded border border-gray-200 overflow-hidden">

        {/* Control Panel */}
        <ControlPanel
          total={roles.length} canCreate={canCreate} canDelete={canDelete}
          onNew={() => setModal({ type: 'create' })}
          onBulkDelete={handleBulkDelete} selectedCount={selected.size}
        />

        {/* Table */}
        <div className="overflow-x-auto">
            {roles.length === 0 ? (
              <div className="py-20 text-center text-sm text-gray-400">No roles found.</div>
            ) : (
              <table className="w-full text-sm" style={{ minWidth: 560 }}>
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pl-3 pr-2 py-3 w-8">
                      <input type="checkbox"
                        checked={selected.size === roles.length && roles.length > 0}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="w-3.5 h-3.5 cursor-pointer rounded-sm"
                        style={{ accentColor: 'var(--ams-primary)' }} />
                    </th>
                    <th className="px-3 py-3 text-left text-gray-500 font-normal">Name</th>
                    <th className="px-3 py-3 text-left text-gray-500 font-normal">Slug</th>
                    <th className="px-3 py-3 text-left text-gray-500 font-normal">Description</th>
                    <th className="px-3 py-3 text-left text-gray-500 font-normal">Type</th>
                    <th className="pl-3 pr-3 py-3 w-16 text-right">
                      <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                      </svg>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer group transition-colors"
                      onClick={() => setModal({ type: 'permissions', role })}>
                      <td className="pl-3 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(role.id)} onChange={() => toggleOne(role.id)}
                          className="w-3.5 h-3.5 cursor-pointer rounded-sm"
                          style={{ accentColor: 'var(--ams-primary)' }} />
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-800">{role.name}</td>
                      <td className="px-3 py-3">
                        <code className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{role.slug}</code>
                      </td>
                      <td className="px-3 py-3 text-gray-500">{role.description || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-3">
                        {role.is_system ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: 'var(--ams-primary-mid)', color: 'var(--ams-primary)' }}>
                            System
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                            Custom
                          </span>
                        )}
                      </td>
                      <td className="pl-3 pr-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setModal({ type: 'permissions', role })}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                            title="Manage permissions">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                            </svg>
                          </button>
                          {canDelete && !role.is_system && (
                            <button onClick={() => setModal({ type: 'delete', role })}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'create'      && <CreateRoleModal onClose={() => setModal(null)} onCreated={handleCreated} />}
      {modal?.type === 'delete'      && <DeleteRoleModal role={modal.role} onClose={() => setModal(null)} onDeleted={handleDeleted} />}
      {modal?.type === 'permissions' && <PermissionPanel role={modal.role} canEdit={canEdit} onClose={() => setModal(null)} />}
      {modal?.type === 'bulk-delete' && (
        <BulkDeleteRolesModal
          ids={modal.ids}
          onClose={() => setModal(null)}
          onDeleted={(ids) => {
            setRoles((prev) => prev.filter((r) => !ids.includes(r.id)));
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
