'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import usePermissions from '@/lib/usePermissions';
import { apiGet } from '@/lib/api';
import { UPLOADS_URL } from '@/lib/config';

function WaffleIcon() {
  const colors = ['#E74C3C', '#3498DB', '#F1C40F', '#2ECC71', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E', '#E91E63'];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <rect key={i} x={(i % 3) * 5.5} y={Math.floor(i / 3) * 5.5} width="4" height="4" rx="0.5" fill={colors[i]} />
      ))}
    </svg>
  );
}

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, can, loading: permLoading } = usePermissions();
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    apiGet('/settings').then((s) => {
      if (s.company_name) {
        setCompanyName(s.company_name);
        document.title = s.company_name;
      }
      if (s.company_logo) setCompanyLogo(`${UPLOADS_URL}${s.company_logo}`);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const navItems = [
    { label: 'Dashboard',  href: '/dashboard',           perm: null,             exact: true },
    { label: 'Purchases',  href: '/dashboard/purchases', perm: 'PURCHASE_VIEW'  },
    { label: 'Inventory',  href: '/dashboard/inventory', perm: 'INVENTORY_VIEW' },
    { label: 'Sales',      href: '/dashboard/sales',     perm: 'SALE_VIEW'      },
    { label: 'Projects',   href: '/dashboard/projects',  perm: 'PROJECT_VIEW'   },
    { label: 'Brokers',    href: '/dashboard/brokers',   perm: 'BROKER_VIEW'    },
    { label: 'Customers',  href: '/dashboard/customers', perm: 'CUSTOMER_VIEW'  },
    { label: 'Reports',    href: '/dashboard/reports',   perm: 'REPORTS_VIEW'   },
    { label: 'Users',      href: '/dashboard/users',     perm: 'USER_VIEW'      },
    { label: 'Roles',      href: '/dashboard/roles',     perm: 'ROLE_VIEW'      },
    { label: 'Settings',   href: '/dashboard/settings',  perm: 'SETTINGS_VIEW'  },
  ];

  const isVisible = (perm) => {
    if (!perm) return true;
    if (me?.is_system) return true;
    return can(perm);
  };

  const isActive = (href, exact) => exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
  const initials = me?.name ? me.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      <header className="flex items-center px-2 py-3 shrink-0 z-40 print:hidden" style={{ backgroundColor: '#1f2330' }}>
        <div className="flex items-center justify-center w-8 h-8 rounded shrink-0">
          {companyLogo
            ? <img src={companyLogo} alt={companyName} className="w-8 h-8 object-contain rounded" />
            : <WaffleIcon />}
        </div>
        <div className="flex items-center gap-2 mx-2 min-w-0 shrink-0">
          <span className="text-white font-semibold text-sm truncate max-w-36">{companyName}</span>
        </div>
        <div className="w-px h-5 bg-white/20 mr-2 shrink-0" />

        {!permLoading && (
          <nav className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            {navItems.filter((item) => isVisible(item.perm)).map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="shrink-0 px-3 py-1 rounded text-sm transition-colors whitespace-nowrap"
                  style={active ? { backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 500 } : { color: 'rgba(255,255,255,0.65)' }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-1 ml-2 shrink-0" ref={menuRef}>
          <span className="text-white/60 text-xs hidden lg:block px-1 max-w-32 truncate">{me?.name}</span>
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold hover:ring-2 hover:ring-white/30 transition"
              style={{ backgroundColor: '#875A7B' }}
              aria-label="Open user menu"
            >
              {initials}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-800 truncate">{me?.name}</p>
                  <p className="text-xs text-gray-400 truncate">{me?.email}</p>
                </div>
                <button onClick={handleLogout} className="w-full px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition text-left">Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-white">{children}</main>
    </div>
  );
}
