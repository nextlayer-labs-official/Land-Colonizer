'use client';

import { FieldLabel, FInput, FTextarea, FSelect } from './shared';

export default function BrokerFormBody({ form, set, readOnly = false }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">

      <div>
        <FieldLabel required>Full Name</FieldLabel>
        <FInput value={form.name} onChange={set('name')} placeholder="Broker full name" readOnly={readOnly} autoFocus={!readOnly} />
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
        <FieldLabel>Details</FieldLabel>
        <FTextarea value={form.details} onChange={set('details')} placeholder="Commission terms, notes…" rows={3} readOnly={readOnly} />
      </div>

    </div>
  );
}
