'use client';

import { FieldLabel, FInput, FTextarea, FSelect, SectionDivider, CUSTOMER_TYPES } from './shared';

export default function CustomerFormBody({ form, set, readOnly = false }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">

      <SectionDivider title="Basic Information" />

      <div>
        <FieldLabel required>Full Name</FieldLabel>
        <FInput value={form.name} onChange={set('name')} placeholder="Customer full name" readOnly={readOnly} autoFocus={!readOnly} />
      </div>

      <div>
        <FieldLabel>Type</FieldLabel>
        <FSelect value={form.type} onChange={set('type')} readOnly={readOnly}>
          {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
        </FSelect>
      </div>

      <div>
        <FieldLabel>Phone</FieldLabel>
        <FInput type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 XXXXX XXXXX" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Email</FieldLabel>
        <FInput type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Status</FieldLabel>
        <FSelect value={form.status} onChange={set('status')} readOnly={readOnly}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </FSelect>
      </div>

      <div className="col-span-full">
        <FieldLabel>Address</FieldLabel>
        <FTextarea value={form.address} onChange={set('address')} placeholder="Full address..." rows={2} readOnly={readOnly} />
      </div>

      <SectionDivider title="Identity Proof" />

      <div>
        <FieldLabel>PAN</FieldLabel>
        <FInput value={form.pan} onChange={set('pan')} placeholder="PAN number" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Aadhaar</FieldLabel>
        <FInput value={form.aadhaar} onChange={set('aadhaar')} placeholder="Aadhaar number" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Other</FieldLabel>
        <FInput value={form.other} onChange={set('other')} placeholder="Passport / Voter ID / Driving Licence…" readOnly={readOnly} />
      </div>

    </div>
  );
}
