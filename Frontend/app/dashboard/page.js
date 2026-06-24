'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import { apiGet } from '@/lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const fmt    = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtCr  = (n) => {
  const v = Number(n || 0);
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(2)} L`;
  if (v > 0)           return `₹${v.toLocaleString('en-IN')}`;
  return '₹0';
};
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Pulse({ className }) {
  return <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />;
}
function DashboardSkeleton() {
  return (
    <div className="space-y-5 p-4 pb-10 max-w-7xl">
      <Pulse className="h-24 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Pulse key={i} className="h-32" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Pulse className="h-52" />
        <Pulse className="h-52" />
      </div>
      <Pulse className="h-48" />
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, bg, iconBg, valueColor = 'text-gray-900', href }) {
  const inner = (
    <div className={`rounded-2xl border border-gray-100 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all group ${bg || 'bg-white'}`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        {href && (
          <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      <div>
        <p className={`text-2xl font-black leading-none ${valueColor}`}>{value}</p>
        <p className="text-[11px] font-semibold text-gray-400 mt-1.5 uppercase tracking-wider">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Inventory Health Card ─────────────────────────────────────────────────────
const INV_STATUS = [
  { key: 'available',  label: 'Available',  bar: 'bg-emerald-400', dot: 'bg-emerald-400', text: 'text-emerald-700', pill: 'bg-emerald-50 text-emerald-700' },
  { key: 'reserved',   label: 'Reserved',   bar: 'bg-amber-400',   dot: 'bg-amber-400',   text: 'text-amber-700',   pill: 'bg-amber-50 text-amber-700'   },
  { key: 'sold',       label: 'Sold',       bar: 'bg-blue-400',    dot: 'bg-blue-400',    text: 'text-blue-700',    pill: 'bg-blue-50 text-blue-700'    },
  { key: 'registered', label: 'Registered', bar: 'bg-[#875A7B]',   dot: 'bg-[#875A7B]',  text: 'text-[#875A7B]',  pill: 'bg-[#875A7B]/10 text-[#875A7B]' },
];

function InventoryHealthCard({ inventory }) {
  const total = inventory.total || 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">Inventory Health</p>
        <Link href="/dashboard/inventory" className="text-[11px] font-semibold text-[#875A7B] hover:underline">View all →</Link>
      </div>

      {/* Stacked bar */}
      {total > 0 ? (
        <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
          {INV_STATUS.map(({ key, bar }) => {
            const count = inventory[key] || 0;
            if (!count) return null;
            return (
              <div key={key} className={`${bar} transition-all`}
                style={{ width: `${(count / total) * 100}%` }} />
            );
          })}
        </div>
      ) : (
        <div className="h-2.5 rounded-full bg-gray-100" />
      )}

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {INV_STATUS.map(({ key, label, dot, pill }) => {
          const count = inventory[key] || 0;
          return (
            <div key={key} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${pill}`}>{count}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-xs text-gray-400">Total units</span>
        <span className="text-sm font-black text-gray-800">{fmt(total)}</span>
      </div>
    </div>
  );
}

// ── Financial Overview Card ───────────────────────────────────────────────────
function FinancialCard({ sales, purchases }) {
  const totalActual   = sales.total_actual   || 0;
  const totalReceived = sales.total_received || 0;
  const totalNet      = sales.total_net      || 0;
  const purchaseCost  = purchases.cost       || 0;
  const pct = totalActual > 0 ? Math.min(100, Math.round((totalReceived / totalActual) * 100)) : 0;

  const rows = [
    { label: 'Total Sale Value',   value: fmtCr(totalActual),   color: 'text-gray-800',    bold: true },
    { label: 'Amount Received',    value: fmtCr(totalReceived), color: 'text-emerald-700', bold: false },
    { label: 'Net Amount (incl. charges)', value: fmtCr(totalNet), color: 'text-blue-700', bold: false },
    { label: 'Purchase / Land Cost', value: fmtCr(purchaseCost), color: 'text-amber-700', bold: false },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">Financial Overview</p>
        <Link href="/dashboard/sales" className="text-[11px] font-semibold text-[#875A7B] hover:underline">View sales →</Link>
      </div>

      <div className="space-y-3">
        {rows.map(({ label, value, color, bold }) => (
          <div key={label} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-500">{label}</span>
            <span className={`text-sm ${bold ? 'font-black' : 'font-bold'} ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Collection progress */}
      <div className="mt-auto">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
          <span>Collection rate</span>
          <span className="font-bold text-emerald-600">{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          {fmtCr(totalReceived)} received of {fmtCr(totalActual)} total
        </p>
      </div>
    </div>
  );
}

// ── Recent Sales ──────────────────────────────────────────────────────────────
function RecentSalesCard({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <p className="text-sm font-bold text-gray-800">Recent Sales</p>
        <Link href="/dashboard/sales" className="text-[11px] font-semibold text-[#875A7B] hover:underline">View all →</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/60">
              {['Sale', 'Customer', 'Plot', 'Value', 'Received', 'Date'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => {
              const pct = row.value > 0 ? Math.min(100, Math.round((row.received / row.value) * 100)) : 0;
              return (
                <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/sales/${row.id}`}
                      className="text-[11px] font-bold text-[#875A7B] hover:underline">{row.sale_code}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-gray-800">{row.customer}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-500 font-medium">{row.plot}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-gray-800">{fmtINR(row.value)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 shrink-0">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-400">{fmtDate(row.date)}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────────────────
function QuickLink({ href, icon, label }) {
  return (
    <Link href={href}
      className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-100 hover:border-[#875A7B]/40 hover:bg-[#875A7B]/5 group transition-all shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-[#875A7B]/10 flex items-center justify-center group-hover:bg-[#875A7B]/20 transition-colors">
        {icon}
      </div>
      <span className="text-xs font-semibold text-gray-600 group-hover:text-[#875A7B] text-center leading-tight transition-colors">{label}</span>
    </Link>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/dashboard').then(setData).catch(() => setData({})).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const { user, reStats = {}, recentSales = [], orgStats } = data || {};
  const today    = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const inv      = reStats.inventory || {};
  const sales    = reStats.sales     || {};
  const customers = reStats.customers || {};
  const purchases = reStats.purchases || {};

  return (
    <div className="p-4 pb-10 space-y-5 max-w-7xl">

      {/* ── Welcome banner ── */}
      <div className="rounded-2xl overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #875A7B 0%, #6d4264 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 0%, transparent 60%)' }} />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white leading-tight">
              {greeting()}, {user?.name?.split(' ')[0] || 'there'}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${user?.is_system ? 'bg-orange-300/30 text-orange-100' : 'bg-white/20 text-white/80'}`}>
                {user?.is_system ? '⚡ System Admin' : user?.role || 'User'}
              </span>
              <span className="text-white/40 text-[10px]">·</span>
              <span className="text-white/60 text-[10px]">{today}</span>
            </div>
          </div>
          {/* Inline mini-stats */}
          <div className="hidden sm:flex items-center gap-4">
            {[
              { label: 'Units',     value: fmt(inv.total) },
              { label: 'Sales',     value: fmt(sales.count) },
              { label: 'Customers', value: fmt(customers.total) },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-xl font-black text-white leading-none">{value}</p>
                <p className="text-[9px] text-white/50 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Primary KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Inventory Units"
          value={fmt(inv.total)}
          sub={`${fmt(inv.available)} available`}
          href="/dashboard/inventory"
          iconBg="bg-[#875A7B]/10"
          icon={<svg className="w-5 h-5 text-[#875A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10l1.5-5h15L21 10M3 10h18M3 10v9a1 1 0 001 1h16a1 1 0 001-1v-9"/></svg>}
        />
        <KpiCard
          label="Active Sales"
          value={fmt(sales.count)}
          sub={fmtCr(sales.total_actual) + ' total value'}
          href="/dashboard/sales"
          iconBg="bg-blue-50"
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
        />
        <KpiCard
          label="Active Customers"
          value={fmt(customers.total)}
          href="/dashboard/customers"
          iconBg="bg-rose-50"
          icon={<svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
        />
        <KpiCard
          label="Amount Received"
          value={fmtCr(sales.total_received)}
          sub={`of ${fmtCr(sales.total_actual)} total`}
          iconBg="bg-emerald-50"
          valueColor="text-emerald-700"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
      </div>

      {/* ── Inventory Health + Financial Overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InventoryHealthCard inventory={inv} />
        <FinancialCard sales={sales} purchases={purchases} />
      </div>

      {/* ── Recent Sales ── */}
      <RecentSalesCard rows={recentSales} />

      {/* ── Quick Actions ── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <QuickLink href="/dashboard/sales/new" label="New Sale"
            icon={<svg className="w-5 h-5 text-[#875A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4"/></svg>} />
          <QuickLink href="/dashboard/customers/new" label="New Customer"
            icon={<svg className="w-5 h-5 text-[#875A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>} />
          <QuickLink href="/dashboard/inventory" label="Inventory"
            icon={<svg className="w-5 h-5 text-[#875A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>} />
          <QuickLink href="/dashboard/brokers" label="Brokers"
            icon={<svg className="w-5 h-5 text-[#875A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>} />
          <QuickLink href="/dashboard/purchases" label="Purchases"
            icon={<svg className="w-5 h-5 text-[#875A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>} />
          <QuickLink href="/dashboard/customers" label="Customers"
            icon={<svg className="w-5 h-5 text-[#875A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>} />
        </div>
      </div>

      {/* ── System (admin only) ── */}
      {orgStats && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">System</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard
              label="Active Users"
              value={fmt(orgStats.users)}
              href="/dashboard/users"
              iconBg="bg-violet-50"
              icon={<svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
            />
            <KpiCard
              label="Roles"
              value={fmt(orgStats.roles)}
              iconBg="bg-slate-50"
              icon={<svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
            />
          </div>
        </div>
      )}

    </div>
  );
}
