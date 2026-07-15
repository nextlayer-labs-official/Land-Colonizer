'use client';

import { useEffect, useRef, useState } from 'react';
import useAuth from '@/lib/useAuth';
import usePermissions from '@/lib/usePermissions';
import { apiGet, apiPut, apiPost, apiPostForm } from '@/lib/api';
import { API_URL, UPLOADS_URL } from '@/lib/config';

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Section({ title, description, children }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Alert({ type, message }) {
  if (!message) return null;
  const cls = type === 'success'
    ? 'bg-green-50 border-green-200 text-green-700'
    : 'bg-red-50 border-red-200 text-red-700';
  return <div className={`border px-4 py-3 rounded-lg text-sm ${cls}`}>{message}</div>;
}

function SaveBtn({ saving, label = 'Save Changes' }) {
  return (
    <button type="submit" disabled={saving} className="btn-primary">
      {saving ? 'Saving…' : label}
    </button>
  );
}

function Avatar({ name }) {
  const p   = (name || '').trim().split(' ').filter(Boolean);
  const ini = p.length >= 2 ? p[0][0] + p[p.length - 1][0] : (p[0] || '?').slice(0, 2);
  return (
    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
      style={{ backgroundColor: 'var(--ams-primary)' }}>
      <span className="uppercase">{ini}</span>
    </div>
  );
}

function TabNav({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-gray-200 -mb-px">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="px-5 py-2.5 text-sm font-medium border-b-2 transition-colors"
          style={
            active === t.key
              ? { borderColor: 'var(--ams-primary)', color: 'var(--ams-primary)' }
              : { borderColor: 'transparent', color: '#6B7280' }
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ me }) {
  const [profile,    setProfile]    = useState({ name: '', email: '', phone: '' });
  const [profMsg,    setProfMsg]    = useState({ type: '', text: '' });
  const [profSaving, setProfSaving] = useState(false);
  const [passwords,  setPasswords]  = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passMsg,    setPassMsg]    = useState({ type: '', text: '' });
  const [passSaving, setPassSaving] = useState(false);
  const [info,       setInfo]       = useState(null);

  useEffect(() => {
    if (!me) return;
    setProfile({ name: me.name || '', email: me.email || '', phone: '' });
    apiGet('/auth/profile')
      .then((u) => { setProfile({ name: u.name || '', email: u.email || '', phone: u.phone || '' }); setInfo(u); })
      .catch(() => setInfo({ name: me.name, email: me.email, role: me.role }));
  }, [me?.id]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profile.name.trim()) return setProfMsg({ type: 'error', text: 'Name is required' });
    setProfSaving(true); setProfMsg({ type: '', text: '' });
    try {
      await apiPut('/auth/profile', profile);
      setProfMsg({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) { setProfMsg({ type: 'error', text: err.message }); }
    finally { setProfSaving(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password)
      return setPassMsg({ type: 'error', text: 'New passwords do not match' });
    if (passwords.new_password.length < 6)
      return setPassMsg({ type: 'error', text: 'Password must be at least 6 characters' });
    setPassSaving(true); setPassMsg({ type: '', text: '' });
    try {
      await apiPut('/auth/change-password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPassMsg({ type: 'success', text: 'Password changed successfully' });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { setPassMsg({ type: 'error', text: err.message }); }
    finally { setPassSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Account Overview */}
      <Section title="Account Overview">
        <div className="flex items-center gap-4 mb-5">
          <Avatar name={info?.name || me?.name} />
          <div>
            <p className="text-sm font-semibold text-gray-900">{info?.name || me?.name || '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{info?.email || me?.email || '—'}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: 'var(--ams-primary-mid)', color: 'var(--ams-primary)' }}>
              {info?.role?.name || me?.role?.name || '—'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm border-t border-gray-100 pt-4">
          {[
            { label: 'Member Since', value: info?.created_at ? new Date(info.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
            { label: 'Status',  value: info?.status },
            { label: 'Verified', value: info?.is_verified ? 'Yes' : 'No' },
            { label: 'Phone',   value: info?.phone },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
              <p className="text-gray-700 font-medium text-sm">{value || '—'}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Edit Profile */}
      <Section title="Edit Profile" description="Update your name, email and phone number">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Alert type={profMsg.type} message={profMsg.text} />
          <Field label="Full Name">
            <input type="text" value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="Your full name" className="ams-input" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email">
              <input type="email" value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="you@example.com" className="ams-input" />
            </Field>
            <Field label="Phone">
              <input type="text" value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+91 XXXXX XXXXX" className="ams-input" />
            </Field>
          </div>
          <div className="flex justify-end pt-1"><SaveBtn saving={profSaving} /></div>
        </form>
      </Section>

      {/* Permissions */}
      {info?.permsByModule && Object.keys(info.permsByModule).length > 0 && (
        <Section title="My Permissions" description="Based on your current role">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(info.permsByModule).map(([module, actions]) => (
              <div key={module} className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {module === '_system' ? '★ System Admin' : module}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {actions.map((action) => (
                    <span key={action}
                      className="px-2 py-0.5 text-xs font-medium rounded capitalize"
                      style={{ backgroundColor: 'var(--ams-primary-mid)', color: 'var(--ams-primary)' }}>
                      {action.toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Change Password */}
      <Section title="Change Password" description="Keep your account secure with a strong password">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Alert type={passMsg.type} message={passMsg.text} />
          <Field label="Current Password">
            <input type="password" value={passwords.current_password}
              onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
              placeholder="Enter current password" className="ams-input" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="New Password">
              <input type="password" value={passwords.new_password}
                onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                placeholder="Min. 6 characters" className="ams-input" />
            </Field>
            <Field label="Confirm New Password">
              <input type="password" value={passwords.confirm_password}
                onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                placeholder="Repeat new password" className="ams-input" />
            </Field>
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={passSaving} className="btn-primary">
              {passSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}

// ── Company Tab ───────────────────────────────────────────────────────────────
function CompanyTab() {
  const [info,     setInfo]     = useState({ company_name: '', company_address: '', company_phone: '', company_email: '', company_website: '', company_gstin: '' });
  const [infoMsg,  setInfoMsg]  = useState({ type: '', text: '' });
  const [infoSave, setInfoSave] = useState(false);

  const [prefixes,     setPrefixes]     = useState({ purchase_prefix: 'PUR', inventory_prefix: 'INV' });
  const [prefixMsg,    setPrefixMsg]    = useState({ type: '', text: '' });
  const [prefixSaving, setPrefixSaving] = useState(false);

  const [smtp,     setSmtp]     = useState({ smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', smtp_from_name: '', smtp_from_email: '', email_notifications: false });
  const [smtpMsg,  setSmtpMsg]  = useState({ type: '', text: '' });
  const [smtpSave, setSmtpSave] = useState(false);
  const [smtpPassSet, setSmtpPassSet] = useState(false);

  const [testTo,  setTestTo]  = useState('');
  const [testMsg, setTestMsg] = useState({ type: '', text: '' });
  const [testing, setTesting] = useState(false);

  const [logo,          setLogo]          = useState(null);
  const [logoPreview,   setLogoPreview]   = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg,       setLogoMsg]       = useState({ type: '', text: '' });

  useEffect(() => {
    apiGet('/settings').then((s) => {
      setInfo({ company_name: s.company_name || '', company_address: s.company_address || '', company_phone: s.company_phone || '', company_email: s.company_email || '', company_website: s.company_website || '', company_gstin: s.company_gstin || '' });
      setSmtp({ smtp_host: s.smtp_host || '', smtp_port: s.smtp_port || 587, smtp_user: s.smtp_user || '', smtp_pass: '', smtp_from_name: s.smtp_from_name || '', smtp_from_email: s.smtp_from_email || '', email_notifications: s.email_notifications || false });
      setSmtpPassSet(s.smtp_pass_set || false);
      setPrefixes({ purchase_prefix: s.purchase_prefix || 'PUR', inventory_prefix: s.inventory_prefix || 'INV' });
      if (s.company_logo) setLogoPreview(`${UPLOADS_URL}${s.company_logo}`);
    }).catch(() => {});
  }, []);

  const handleSaveInfo = async (e) => {
    e.preventDefault(); setInfoSave(true); setInfoMsg({ type: '', text: '' });
    try { await apiPut('/settings/company', info); setInfoMsg({ type: 'success', text: 'Saved successfully' }); }
    catch (err) { setInfoMsg({ type: 'error', text: err.message }); }
    finally { setInfoSave(false); }
  };

  const handleSavePrefixes = async (e) => {
    e.preventDefault(); setPrefixSaving(true); setPrefixMsg({ type: '', text: '' });
    try {
      await apiPut('/settings/prefixes', prefixes);
      setPrefixMsg({ type: 'success', text: 'Code prefixes saved. New records will use these prefixes.' });
    } catch (err) { setPrefixMsg({ type: 'error', text: err.message }); }
    finally { setPrefixSaving(false); }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault(); setSmtpSave(true); setSmtpMsg({ type: '', text: '' });
    try {
      const payload = { ...smtp };
      if (!payload.smtp_pass) delete payload.smtp_pass;
      await apiPut('/settings/email', payload);
      setSmtpMsg({ type: 'success', text: 'Email settings saved' });
      setSmtp((p) => ({ ...p, smtp_pass: '' }));
      if (smtp.smtp_pass) setSmtpPassSet(true);
    } catch (err) { setSmtpMsg({ type: 'error', text: err.message }); }
    finally { setSmtpSave(false); }
  };

  const handleTestEmail = async (e) => {
    e.preventDefault();
    if (!testTo.trim()) return setTestMsg({ type: 'error', text: 'Enter a recipient email' });
    setTesting(true); setTestMsg({ type: '', text: '' });
    try {
      const res = await apiPost('/settings/test-email', { test_to: testTo });
      setTestMsg({ type: 'success', text: res.message });
    } catch (err) { setTestMsg({ type: 'error', text: err.message }); }
    finally { setTesting(false); }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoUpload = async () => {
    if (!logo) return;
    setLogoUploading(true); setLogoMsg({ type: '', text: '' });
    try {
      const fd    = new FormData();
      fd.append('logo', logo);
      const token = localStorage.getItem('token');
      const { API_URL } = await import('@/lib/config');
      const res = await fetch(`${API_URL}/settings/logo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      setLogoMsg({ type: 'success', text: 'Logo uploaded successfully. Refreshing…' });
      setLogo(null);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) { setLogoMsg({ type: 'error', text: err.message }); }
    finally { setLogoUploading(false); }
  };

  return (
    <div className="space-y-5">
      {/* Company Info */}
      <Section title="Company Information" description="Appears on emails and reports sent to your team">
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <Alert type={infoMsg.type} message={infoMsg.text} />
          <Field label="Company Name">
            <input type="text" value={info.company_name}
              onChange={(e) => setInfo({ ...info, company_name: e.target.value })}
              placeholder="Acme Pvt Ltd" className="ams-input" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact Email">
              <input type="email" value={info.company_email}
                onChange={(e) => setInfo({ ...info, company_email: e.target.value })}
                placeholder="accounts@company.com" className="ams-input" />
            </Field>
            <Field label="Contact Phone">
              <input type="text" value={info.company_phone}
                onChange={(e) => setInfo({ ...info, company_phone: e.target.value })}
                placeholder="+91 XXXXX XXXXX" className="ams-input" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Website">
              <input type="text" value={info.company_website}
                onChange={(e) => setInfo({ ...info, company_website: e.target.value })}
                placeholder="https://company.com" className="ams-input" />
            </Field>
            <Field label="GSTIN">
              <input type="text" value={info.company_gstin}
                onChange={(e) => setInfo({ ...info, company_gstin: e.target.value })}
                placeholder="22AAAAA0000A1Z5" className="ams-input" />
            </Field>
          </div>
          <Field label="Address">
            <textarea value={info.company_address}
              onChange={(e) => setInfo({ ...info, company_address: e.target.value })}
              rows={3} placeholder="Full company address" className="ams-input resize-none" />
          </Field>
          <div className="flex justify-end pt-1"><SaveBtn saving={infoSave} /></div>
        </form>
      </Section>

      {/* Code Prefixes */}
      <Section title="Code Prefixes" description="Auto-generated codes for Purchases and Inventory units (e.g. PUR-0001, INV-0001)">
        <form onSubmit={handleSavePrefixes} className="space-y-4">
          <Alert type={prefixMsg.type} message={prefixMsg.text} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Purchase Code Prefix" hint={`e.g. "${prefixes.purchase_prefix}-0001"`}>
              <input type="text" value={prefixes.purchase_prefix} maxLength={10}
                onChange={(e) => setPrefixes({ ...prefixes, purchase_prefix: e.target.value.toUpperCase() })}
                placeholder="PUR" className="ams-input" />
            </Field>
            <Field label="Inventory Code Prefix" hint={`e.g. "${prefixes.inventory_prefix}-0001"`}>
              <input type="text" value={prefixes.inventory_prefix} maxLength={10}
                onChange={(e) => setPrefixes({ ...prefixes, inventory_prefix: e.target.value.toUpperCase() })}
                placeholder="INV" className="ams-input" />
            </Field>
          </div>
          <p className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2 border border-gray-100">
            Changing a prefix only affects <strong>new</strong> records — existing codes will not be renamed.
          </p>
          <div className="flex justify-end pt-1"><SaveBtn saving={prefixSaving} /></div>
        </form>
      </Section>

      {/* Logo */}
      <Section title="Company Logo" description="Displayed on email notifications (max 2 MB, image files only)">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
            {logoPreview
              ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
              : <span className="text-xs text-gray-400">No logo</span>}
          </div>
          <div className="flex-1 space-y-3">
            <Alert type={logoMsg.type} message={logoMsg.text} />
            <div className="flex items-center gap-3 flex-wrap">
              <label className="btn-secondary cursor-pointer">
                Choose File
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
              {logo && (
                <button onClick={handleLogoUpload} disabled={logoUploading} className="btn-primary">
                  {logoUploading ? 'Uploading…' : 'Upload'}
                </button>
              )}
              {logo && <span className="text-xs text-gray-500 truncate max-w-32">{logo.name}</span>}
            </div>
          </div>
        </div>
      </Section>

      {/* SMTP */}
      <Section title="Email / SMTP Settings" description="Configure outgoing email for notifications and password reset">
        <form onSubmit={handleSaveSmtp} className="space-y-4">
          <Alert type={smtpMsg.type} message={smtpMsg.text} />
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer">
            <input type="checkbox" checked={smtp.email_notifications}
              onChange={(e) => setSmtp({ ...smtp, email_notifications: e.target.checked })}
              className="w-4 h-4 rounded" style={{ accentColor: 'var(--ams-primary)' }} />
            <span className="text-sm text-gray-700">Enable email notifications</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Field label="SMTP Host" hint="e.g. smtp.gmail.com or smtp.sendgrid.net">
                <input type="text" value={smtp.smtp_host}
                  onChange={(e) => setSmtp({ ...smtp, smtp_host: e.target.value })}
                  placeholder="smtp.gmail.com" className="ams-input" />
              </Field>
            </div>
            <Field label="SMTP Port" hint="Usually 587 (TLS) or 465 (SSL)">
              <input type="number" value={smtp.smtp_port}
                onChange={(e) => setSmtp({ ...smtp, smtp_port: Number(e.target.value) })}
                placeholder="587" className="ams-input" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="SMTP Username / Email">
              <input type="text" value={smtp.smtp_user}
                onChange={(e) => setSmtp({ ...smtp, smtp_user: e.target.value })}
                placeholder="yourname@gmail.com" className="ams-input" />
            </Field>
            <Field label={smtpPassSet ? 'SMTP Password (leave blank to keep)' : 'SMTP Password'}
              hint={smtpPassSet ? 'A password is already saved.' : ''}>
              <input type="password" value={smtp.smtp_pass}
                onChange={(e) => setSmtp({ ...smtp, smtp_pass: e.target.value })}
                placeholder={smtpPassSet ? '••••••••' : 'App password or SMTP password'} className="ams-input" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="From Name">
              <input type="text" value={smtp.smtp_from_name}
                onChange={(e) => setSmtp({ ...smtp, smtp_from_name: e.target.value })}
                placeholder="Acme AMS" className="ams-input" />
            </Field>
            <Field label="From Email">
              <input type="email" value={smtp.smtp_from_email}
                onChange={(e) => setSmtp({ ...smtp, smtp_from_email: e.target.value })}
                placeholder="noreply@company.com" className="ams-input" />
            </Field>
          </div>
          <div className="flex justify-end pt-1"><SaveBtn saving={smtpSave} /></div>
        </form>

        <div className="mt-5 pt-5 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Test Email Connection</p>
          <form onSubmit={handleTestEmail} className="flex gap-2">
            <input type="email" value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="Send test email to…"
              className="ams-input flex-1" />
            <button type="submit" disabled={testing} className="btn-secondary whitespace-nowrap">
              {testing ? 'Sending…' : 'Send Test'}
            </button>
          </form>
          {testMsg.text && <div className="mt-2"><Alert type={testMsg.type} message={testMsg.text} /></div>}
        </div>
      </Section>
    </div>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────────────
function SecurityTab() {
  const [security,  setSecurity]  = useState({ login_max_attempts: 5, login_window_minutes: 15, max_upload_mb: 5 });
  const [secMsg,    setSecMsg]    = useState({ type: '', text: '' });
  const [secSaving, setSecSaving] = useState(false);

  useEffect(() => {
    apiGet('/settings').then((s) => {
      setSecurity({ login_max_attempts: s.login_max_attempts || 5, login_window_minutes: s.login_window_minutes || 15, max_upload_mb: s.max_upload_mb || 5 });
    }).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault(); setSecSaving(true); setSecMsg({ type: '', text: '' });
    try {
      await apiPut('/settings/security', security);
      setSecMsg({ type: 'success', text: 'Security settings saved. Rate limits apply immediately.' });
    } catch (err) { setSecMsg({ type: 'error', text: err.message }); }
    finally { setSecSaving(false); }
  };

  return (
    <div className="space-y-5">
      <Section title="Login Security" description="Control how many login attempts are allowed before an IP is temporarily blocked">
        <form onSubmit={handleSave} className="space-y-4">
          <Alert type={secMsg.type} message={secMsg.text} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Max Login Attempts" hint="Failed attempts before blocking (1–100)">
              <input type="number" min={1} max={100} value={security.login_max_attempts}
                onChange={(e) => setSecurity({ ...security, login_max_attempts: Number(e.target.value) })}
                className="ams-input" />
            </Field>
            <Field label="Block Window (minutes)" hint="How long to block after too many failures (1–1440)">
              <input type="number" min={1} max={1440} value={security.login_window_minutes}
                onChange={(e) => setSecurity({ ...security, login_window_minutes: Number(e.target.value) })}
                className="ams-input" />
            </Field>
          </div>

          <div className="p-3 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--ams-primary-mid)', borderColor: '#d9bdd1', color: '#5a3d54' }}>
            Block an IP after <strong>{security.login_max_attempts} failed attempts</strong> within{' '}
            <strong>{security.login_window_minutes} minutes</strong>. The block lifts automatically after the window expires.
          </div>

          <div className="pt-3 border-t border-gray-100">
            <Field label="Max File Upload Size (MB)" hint="Applies to attachments (1–50 MB)">
              <input type="number" min={1} max={50} value={security.max_upload_mb}
                onChange={(e) => setSecurity({ ...security, max_upload_mb: Number(e.target.value) })}
                className="ams-input" />
            </Field>
          </div>

          <div className="flex justify-end pt-1"><SaveBtn saving={secSaving} /></div>
        </form>
      </Section>

      <Section title="Security Tips">
        <ul className="space-y-2 text-sm text-gray-600">
          {[
            'Change the default admin password immediately after first login.',
            'Deactivate user accounts as soon as an employee leaves.',
            'Use a strong JWT_SECRET (min 32 random characters) in your server .env file.',
            'Keep your server OS and Node.js version updated regularly.',
            'Restrict SSH access to known IPs only via your firewall/security group.',
            'Set ALLOWED_ORIGIN to your exact frontend domain — never use a wildcard in production.',
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5" style={{ color: 'var(--ams-primary)' }}>✓</span>
              {tip}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

// ── Integrations Tab (Google Drive) ───────────────────────────────────────────
function IntegrationsTab() {
  const [drive, setDrive] = useState({
    google_drive_enabled:            false,
    google_drive_purchase_folder_id: '',
    google_drive_sale_folder_id:     '',
  });
  const [jsonSet,    setJsonSet]    = useState(false);
  const [jsonEmail,  setJsonEmail]  = useState('');
  const [driveMsg,   setDriveMsg]   = useState({ type: '', text: '' });
  const [driveSave,  setDriveSave]  = useState(false);

  const [jsonFile,      setJsonFile]      = useState(null);
  const [jsonUploading, setJsonUploading] = useState(false);
  const [jsonMsg,       setJsonMsg]       = useState({ type: '', text: '' });
  const jsonRef = useRef(null);

  useEffect(() => {
    apiGet('/settings').then((s) => {
      setDrive({
        google_drive_enabled:            s.google_drive_enabled            || false,
        google_drive_purchase_folder_id: s.google_drive_purchase_folder_id || '',
        google_drive_sale_folder_id:     s.google_drive_sale_folder_id     || '',
      });
      setJsonSet(s.google_drive_json_set || false);
    }).catch(() => {});
  }, []);

  const handleSaveDrive = async (e) => {
    e.preventDefault(); setDriveSave(true); setDriveMsg({ type: '', text: '' });
    try {
      await apiPut('/settings/drive', drive);
      setDriveMsg({ type: 'success', text: 'Google Drive settings saved' });
    } catch (err) { setDriveMsg({ type: 'error', text: err.message }); }
    finally { setDriveSave(false); }
  };

  const handleJsonChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setJsonFile(file);
  };

  const handleJsonUpload = async () => {
    if (!jsonFile) return;
    setJsonUploading(true); setJsonMsg({ type: '', text: '' });
    try {
      const fd = new FormData();
      fd.append('json', jsonFile);
      const res = await apiPostForm('/settings/drive/json', fd);
      setJsonSet(true);
      setJsonEmail(res.client_email || '');
      setJsonMsg({ type: 'success', text: 'Service account JSON saved successfully' });
      setJsonFile(null);
      if (jsonRef.current) jsonRef.current.value = '';
    } catch (err) { setJsonMsg({ type: 'error', text: err.message }); }
    finally { setJsonUploading(false); }
  };

  const configured = jsonSet &&
    drive.google_drive_purchase_folder_id.trim() &&
    drive.google_drive_sale_folder_id.trim();

  return (
    <div className="space-y-5">
      {/* Status card */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border"
        style={{ backgroundColor: configured ? '#f0fdf4' : '#fafafa', borderColor: configured ? '#bbf7d0' : '#e5e7eb' }}>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${configured ? 'bg-green-400' : 'bg-gray-300'}`} />
        <div>
          <p className="text-sm font-medium" style={{ color: configured ? '#15803d' : '#6b7280' }}>
            {configured ? 'Google Drive is configured and ready' : 'Google Drive is not fully configured'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: configured ? '#16a34a' : '#9ca3af' }}>
            {configured
              ? `Enabled: ${drive.google_drive_enabled ? 'Yes' : 'No'} · Documents will ${drive.google_drive_enabled ? '' : 'not '}appear on purchase and sale pages`
              : 'Upload a service account JSON and set both folder IDs below'}
          </p>
        </div>
      </div>

      {/* Enable toggle + folder IDs */}
      <Section title="Google Drive Settings" description="Control document storage via Google Drive">
        <form onSubmit={handleSaveDrive} className="space-y-5">
          <Alert type={driveMsg.type} message={driveMsg.text} />

          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-700">Enable Google Drive</p>
              <p className="text-xs text-gray-400 mt-0.5">Show the Documents section on purchase and sale records</p>
            </div>
            <div
              onClick={() => setDrive(p => ({ ...p, google_drive_enabled: !p.google_drive_enabled }))}
              className="relative w-11 h-6 rounded-full cursor-pointer transition-colors shrink-0"
              style={{ backgroundColor: drive.google_drive_enabled ? 'var(--ams-primary)' : '#d1d5db' }}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${drive.google_drive_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </label>

          <div className="space-y-4">
            <Field label="Purchase Folder ID" hint="Google Drive folder ID for purchase documents">
              <input type="text"
                value={drive.google_drive_purchase_folder_id}
                onChange={(e) => setDrive(p => ({ ...p, google_drive_purchase_folder_id: e.target.value }))}
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                className="ams-input font-mono text-xs" />
            </Field>
            <Field label="Sale Folder ID" hint="Google Drive folder ID for sale documents">
              <input type="text"
                value={drive.google_drive_sale_folder_id}
                onChange={(e) => setDrive(p => ({ ...p, google_drive_sale_folder_id: e.target.value }))}
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                className="ams-input font-mono text-xs" />
            </Field>
          </div>

          <p className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2 border border-gray-100">
            Copy the folder ID from the Google Drive URL: drive.google.com/drive/folders/<strong>FOLDER_ID</strong>
          </p>

          <div className="flex justify-end pt-1"><SaveBtn saving={driveSave} /></div>
        </form>
      </Section>

      {/* Service account JSON upload */}
      <Section title="Service Account Credentials" description="Upload the Google service account JSON key file">
        <div className="space-y-4">
          <Alert type={jsonMsg.type} message={jsonMsg.text} />

          {jsonSet && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <div>
                <p className="text-sm font-medium text-green-700">Service account JSON is configured</p>
                {jsonEmail && <p className="text-xs text-green-600 mt-0.5 font-mono">{jsonEmail}</p>}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {jsonSet ? 'Replace JSON file' : 'Upload JSON file'}
            </p>
            <div className="flex items-center gap-3">
              <label className="btn-secondary cursor-pointer text-sm">
                Choose File
                <input
                  ref={jsonRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleJsonChange}
                  className="hidden"
                />
              </label>
              {jsonFile && (
                <>
                  <span className="text-xs text-gray-500 truncate max-w-44">{jsonFile.name}</span>
                  <button
                    type="button"
                    onClick={handleJsonUpload}
                    disabled={jsonUploading}
                    className="btn-primary text-sm"
                  >
                    {jsonUploading ? 'Uploading…' : 'Upload'}
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Download this from Google Cloud Console → IAM & Admin → Service Accounts → your service account → Keys → Add Key → JSON.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ── Backup Tab ────────────────────────────────────────────────────────────────
function BackupTab() {
  const [exporting,  setExporting]  = useState(false);
  const [exportMsg,  setExportMsg]  = useState({ type: '', text: '' });
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring,  setRestoring]  = useState(false);
  const [restoreMsg, setRestoreMsg] = useState({ type: '', text: '' });
  const [confirm,    setConfirm]    = useState(false);
  const fileRef = useRef(null);

  const handleExport = async () => {
    setExporting(true); setExportMsg({ type: '', text: '' });
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${API_URL}/backup/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Export failed'); }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ams-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMsg({ type: 'success', text: 'Backup downloaded successfully' });
    } catch (err) {
      setExportMsg({ type: 'error', text: err.message });
    } finally { setExporting(false); }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true); setRestoreMsg({ type: '', text: '' }); setConfirm(false);
    try {
      const fd = new FormData();
      fd.append('backup', restoreFile);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${API_URL}/backup/restore`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Restore failed');
      // Clear the session token — the user account was wiped and restored from backup,
      // so the current JWT must be discarded and the user must log in again.
      localStorage.removeItem('token');
      window.location.href = '/login?restored=1';
    } catch (err) {
      setRestoreMsg({ type: 'error', text: err.message });
    } finally { setRestoring(false); }
  };

  return (
    <div className="space-y-5">
      {/* Export */}
      <Section title="Download Backup" description="Export all data to a JSON file you can store safely">
        <div className="space-y-4">
          <Alert type={exportMsg.type} message={exportMsg.text} />
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-blue-700 space-y-1">
              <p className="font-semibold">What is included in the backup?</p>
              <p>All database records: users, roles, purchases, inventory, sales, customers, brokers, projects, instalments, and audit logs. The database name is <strong>not</strong> included — the file is safe to restore to any environment.</p>
            </div>
          </div>
          <div className="flex justify-start">
            <button onClick={handleExport} disabled={exporting} className="btn-primary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exporting…' : 'Download Backup'}
            </button>
          </div>
        </div>
      </Section>

      {/* Restore */}
      <Section title="Restore from Backup" description="Replace all current data with a previously exported backup file">
        <div className="space-y-4">
          <Alert type={restoreMsg.type} message={restoreMsg.text} />

          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-xs text-red-700 space-y-1">
              <p className="font-semibold">Warning — this action cannot be undone</p>
              <p>Restoring will permanently delete all current data and replace it with the contents of the backup file. Only upload a file that was exported from this application.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Select Backup File (.json)</label>
            <div className="flex items-center gap-3">
              <label className="btn-secondary cursor-pointer text-sm">
                Choose File
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={e => { setRestoreFile(e.target.files?.[0] || null); setRestoreMsg({ type: '', text: '' }); }}
                  className="hidden"
                />
              </label>
              {restoreFile && (
                <span className="text-xs text-gray-600 truncate max-w-52">{restoreFile.name}</span>
              )}
            </div>
          </div>

          {restoreFile && !confirm && (
            <button
              onClick={() => setConfirm(true)}
              className="btn-secondary border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Restore from this file
            </button>
          )}

          {confirm && (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3">
              <p className="text-sm font-semibold text-red-700">Are you absolutely sure?</p>
              <p className="text-xs text-red-600">
                This will delete <strong>all</strong> existing records and replace them with data from <strong>{restoreFile?.name}</strong>. There is no way to undo this.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="btn-primary text-sm"
                  style={{ backgroundColor: '#dc2626' }}
                >
                  {restoring ? 'Restoring…' : 'Yes, restore now'}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  disabled={restoring}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  useAuth();
  const { me, loading: permLoading } = usePermissions();
  const isSystemAdmin = me?.is_system;

  const tabs = [
    { key: 'profile', label: 'My Profile' },
    ...(isSystemAdmin ? [
      { key: 'company',      label: 'Company'      },
      { key: 'security',     label: 'Security'     },
      { key: 'integrations', label: 'Integrations' },
      { key: 'backup',       label: 'Backup'       },
    ] : []),
  ];

  const [activeTab, setActiveTab] = useState('profile');

  if (permLoading || !me) return (
    <div className="space-y-4 animate-pulse max-w-2xl p-4">
      <div className="h-6 w-28 bg-gray-200 rounded" />
      <div className="h-px w-full bg-gray-200 rounded" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
          <div className="h-4 w-36 bg-gray-200 rounded" />
          {[1, 2].map((j) => <div key={j} className="h-9 bg-gray-100 rounded-lg" />)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl p-4 pb-8">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-800">Settings</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {isSystemAdmin
            ? 'Manage your profile, company details and security configuration'
            : 'Manage your account and preferences'}
        </p>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="mb-5">
          <TabNav tabs={tabs} active={activeTab} onChange={setActiveTab} />
        </div>
      )}

      {activeTab === 'profile'       && <ProfileTab       me={me} />}
      {activeTab === 'company'       && <CompanyTab       />}
      {activeTab === 'security'      && <SecurityTab      />}
      {activeTab === 'integrations'  && <IntegrationsTab  />}
      {activeTab === 'backup'        && <BackupTab        />}
    </div>
  );
}
