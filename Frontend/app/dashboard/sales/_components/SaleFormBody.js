'use client';

import {
  FieldLabel, FInput, FTextarea, FSelect, ComputedBox, SectionDivider,
  SALE_TYPES, POSSESSION_STATES, TYPE_LABEL, POSS_LABEL,
  CustomerPicker, BrokerPicker, InventoryPicker,
  computed, fmtINR, fmtNum,
} from './shared';

const AREA_UNITS = ['gaj', 'sq.ft', 'sq.yd', 'sq.m', 'cents', 'acres', 'guntas', 'bigha', 'marla', 'kanal'];

export default function SaleFormBody({ form, set, setForm, readOnly = false, showFinancials = false }) {
  const c = computed(form);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">

      <SectionDivider title="Sale Information" />

      <div>
        <FieldLabel required>Inventory Unit</FieldLabel>
        {readOnly ? (
          <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">
            {form._inventory ? `${form._inventory.inventory_code || ''} · ${form._inventory.plot_no || form._inventory.sl_no || ''}`.trim().replace(/^·\s*/, '') : (form.inventory_id ? `INV-${String(form.inventory_id).padStart(4,'0')}` : <span className="text-gray-300">—</span>)}
          </div>
        ) : (
          <InventoryPicker
            value={form._inventory}
            onPick={(u) => setForm(p => ({
              ...p,
              inventory_id:        u.id,
              type:                SALE_TYPES.includes(u.type) ? u.type : p.type,
              sl_no:               u.sl_no || '',
              front_area:          u.front_area  != null ? String(u.front_area)  : '',
              front_area_details:  u.front_area_details || u.area_unit || '',
              back_area:           u.back_area   != null ? String(u.back_area)   : '',
              back_area_details:   u.back_area_details  || u.area_unit || '',
              plot_rate:           u.rate        != null ? String(u.rate)        : (u.purchase?.rate != null ? String(u.purchase.rate) : p.plot_rate),
              _inventory:          u,
            }))}
            onClear={() => setForm(p => ({ ...p, inventory_id: '', _inventory: null }))}
          />
        )}
      </div>

      <div>
        <FieldLabel required>Sale Date</FieldLabel>
        <FInput type="date" value={form.sale_date?.split?.('T')?.[0] ?? form.sale_date ?? ''} onChange={set('sale_date')} readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Type</FieldLabel>
        <FSelect value={form.type} onChange={set('type')} readOnly={readOnly}>
          <option value="">— Select type —</option>
          {SALE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </FSelect>
      </div>

      <div>
        <FieldLabel>SL. No.</FieldLabel>
        <FInput value={form.sl_no} onChange={set('sl_no')} placeholder="Serial number" readOnly={readOnly} />
      </div>

      <div className="col-span-full">
        <FieldLabel>Details</FieldLabel>
        <FTextarea value={form.details} onChange={set('details')} placeholder="Plot / property description…" readOnly={readOnly} />
      </div>

      <SectionDivider title="Broker" />

      <div>
        <FieldLabel>Broker ID</FieldLabel>
        {readOnly ? (
          <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">
            {form._broker ? `${form._broker.broker_code || ''} ${form._broker.name || ''}`.trim() : (form.broker_id ? `BRK-${String(form.broker_id).padStart(4,'0')}` : <span className="text-gray-300">—</span>)}
          </div>
        ) : (
          <BrokerPicker
            value={form._broker}
            onPick={(b) => setForm(p => ({ ...p, broker_id: b.id, broker_name: b.name, _broker: b, broker_details: [b.phone, b.email].filter(Boolean).join(' · ') }))}
            onClear={() => setForm(p => ({ ...p, broker_id: '', broker_name: '', _broker: null, broker_details: '' }))}
          />
        )}
      </div>

      <div>
        <FieldLabel>Broker Name</FieldLabel>
        <FInput value={form.broker_name} onChange={set('broker_name')} placeholder="Broker name" readOnly={readOnly} />
      </div>

      <div className="col-span-full">
        <FieldLabel>Broker Details</FieldLabel>
        <FTextarea value={form.broker_details} onChange={set('broker_details')} placeholder="Commission arrangement, notes…" readOnly={readOnly} />
      </div>

      {showFinancials && (
        <>
          <SectionDivider title="Customer" />

          <div>
            <FieldLabel>Customer ID</FieldLabel>
            {readOnly ? (
              <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">
                {form._customer ? `${form._customer.customer_code || ''} ${form._customer.name || ''}`.trim() : (form.customer_id ? `CUS-${String(form.customer_id).padStart(4,'0')}` : <span className="text-gray-300">—</span>)}
              </div>
            ) : (
              <CustomerPicker
                value={form._customer}
                onPick={(c) => setForm(p => ({ ...p, customer_id: c.id, _customer: c }))}
                onClear={() => setForm(p => ({ ...p, customer_id: '', _customer: null }))}
              />
            )}
          </div>

          <div>
            <FieldLabel>Customer Name</FieldLabel>
            <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">{form._customer?.name || <span className="text-gray-300">—</span>}</div>
          </div>

          <div>
            <FieldLabel>Customer Contact Number</FieldLabel>
            <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">{form._customer?.phone || <span className="text-gray-300">—</span>}</div>
          </div>
        </>
      )}

      <SectionDivider title="Area Measurement" />

      <div>
        <FieldLabel>Front Area <span className="ml-1 text-[10px] font-normal text-gray-400">· edit in Inventory</span></FieldLabel>
        <FInput type="number" value={form.front_area} placeholder="0" readOnly />
      </div>

      <div>
        <FieldLabel>Front Area Unit</FieldLabel>
        <FInput value={form.front_area_details} placeholder="—" readOnly />
      </div>

      <div>
        <FieldLabel>Back Area <span className="ml-1 text-[10px] font-normal text-gray-400">· edit in Inventory</span></FieldLabel>
        <FInput type="number" value={form.back_area} placeholder="0" readOnly />
      </div>

      <div>
        <FieldLabel>Back Area Unit</FieldLabel>
        <FInput value={form.back_area_details} placeholder="—" readOnly />
      </div>

      <ComputedBox label="Total Area  =  Front × (Back ÷ 9)" value={c.total_area ? fmtNum(parseFloat(c.total_area.toFixed(4))) : '—'} />

      <div>
        <FieldLabel>Total Area Details</FieldLabel>
        <FInput value={form.total_area_details} onChange={set('total_area_details')} placeholder="Area notes…" readOnly={readOnly} />
      </div>

      <SectionDivider title="Pricing" />

      <div>
        <FieldLabel>
          Plot Rate (₹ per unit)
          {form._inventory && !readOnly && <span className="ml-1 text-[10px] font-normal text-emerald-600">· default from unit</span>}
        </FieldLabel>
        <FInput type="number" value={form.plot_rate} onChange={set('plot_rate')} placeholder="0" readOnly={readOnly} />
      </div>

      <ComputedBox label="Total Value  =  Total Area × Plot Rate" value={c.total_value ? fmtINR(c.total_value) : '—'} />

      <div>
        <FieldLabel required>Selling Rate (₹ per unit)</FieldLabel>
        <FInput type="number" value={form.selling_rate} onChange={set('selling_rate')} placeholder="0" readOnly={readOnly} />
      </div>

      <ComputedBox label="Actual Price  =  Selling Rate × Total Area" value={c.actual_price ? fmtINR(c.actual_price) : '—'} accent />

      {showFinancials && <>
        <SectionDivider title="Payments" />

        <div>
          <FieldLabel>Booking Amount (₹)</FieldLabel>
          <FInput type="number" value={form.booking_amount} onChange={set('booking_amount')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Booking Details</FieldLabel>
          <FInput value={form.booking_details} onChange={set('booking_details')} placeholder="Cheque no., bank…" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Advance Payment (₹)</FieldLabel>
          <FInput type="number" value={form.advance_payment} onChange={set('advance_payment')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Advance Payment Details</FieldLabel>
          <FTextarea value={form.advance_payment_details} onChange={set('advance_payment_details')} placeholder="Payment details…" readOnly={readOnly} />
        </div>

        <ComputedBox label="Balance Amount  =  Actual Price − Advance Payment" value={c.actual_price ? fmtINR(c.balance_amount) : '—'} />

        <div>
          <FieldLabel>Balance Amount Details</FieldLabel>
          <FInput value={form.balance_amount_details} onChange={set('balance_amount_details')} placeholder="Notes on balance…" readOnly={readOnly} />
        </div>

        <SectionDivider title="Charges" />

        <div>
          <FieldLabel>Registration Charges (₹)</FieldLabel>
          <FInput type="number" value={form.registration_charges} onChange={set('registration_charges')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Registration Details</FieldLabel>
          <FTextarea value={form.registration_details} onChange={set('registration_details')} placeholder="Registration notes…" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Intkaal Charges (₹)</FieldLabel>
          <FInput type="number" value={form.intkaal_charges} onChange={set('intkaal_charges')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Intkaal Details</FieldLabel>
          <FInput value={form.intkaal_details} onChange={set('intkaal_details')} placeholder="Notes…" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Water Connection Charges (₹)</FieldLabel>
          <FInput type="number" value={form.water_connection_charges} onChange={set('water_connection_charges')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Water Connection Details</FieldLabel>
          <FInput value={form.water_connection_details} onChange={set('water_connection_details')} placeholder="Notes…" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Electricity Meter Charges (₹)</FieldLabel>
          <FInput type="number" value={form.electricity_meter_charges} onChange={set('electricity_meter_charges')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Electricity Meter Details</FieldLabel>
          <FInput value={form.electricity_meter_details} onChange={set('electricity_meter_details')} placeholder="Notes…" readOnly={readOnly} />
        </div>

        <ComputedBox label="Net Amount  =  Booking + Advance + All Charges" value={fmtINR(c.net_amount || 0)} accent />

        <SectionDivider title="Other Financial" />

        <div>
          <FieldLabel>Payment Due Date</FieldLabel>
          <FInput type="date" value={form.payment_due_date?.split?.('T')?.[0] ?? form.payment_due_date ?? ''} onChange={set('payment_due_date')} readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Registration Area</FieldLabel>
          <FInput type="number" value={form.registration_area} onChange={set('registration_area')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Discount (₹)</FieldLabel>
          <FInput type="number" value={form.discount} onChange={set('discount')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Discount Details</FieldLabel>
          <FInput value={form.discount_details} onChange={set('discount_details')} placeholder="Reason…" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Brokerage (₹)</FieldLabel>
          <FInput type="number" value={form.brokerage} onChange={set('brokerage')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Brokerage Details</FieldLabel>
          <FInput value={form.brokerage_details} onChange={set('brokerage_details')} placeholder="Notes…" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Incentive (₹)</FieldLabel>
          <FInput type="number" value={form.incentive} onChange={set('incentive')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Incentive Details</FieldLabel>
          <FInput value={form.incentive_details} onChange={set('incentive_details')} placeholder="Notes…" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Extra Income (₹)</FieldLabel>
          <FInput type="number" value={form.extra_income} onChange={set('extra_income')} placeholder="0" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Extra Income Details</FieldLabel>
          <FInput value={form.extra_income_details} onChange={set('extra_income_details')} placeholder="Notes…" readOnly={readOnly} />
        </div>

        <SectionDivider title="Registration & Possession" />

        <div>
          <FieldLabel>Intkaal Number</FieldLabel>
          <FInput value={form.intkaal_number} onChange={set('intkaal_number')} placeholder="Intkaal number" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Date of Registration</FieldLabel>
          <FInput type="date" value={form.date_of_registration?.split?.('T')?.[0] ?? form.date_of_registration ?? ''} onChange={set('date_of_registration')} readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Vasika</FieldLabel>
          <FInput value={form.vasika} onChange={set('vasika')} placeholder="Vasika reference" readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Possession</FieldLabel>
          <FSelect value={form.possession} onChange={set('possession')} readOnly={readOnly}>
            {POSSESSION_STATES.map(s => <option key={s} value={s}>{POSS_LABEL[s]}</option>)}
          </FSelect>
        </div>

        <div>
          <FieldLabel>Possession Detail</FieldLabel>
          <FInput value={form.possession_detail} onChange={set('possession_detail')} placeholder="Notes…" readOnly={readOnly} />
        </div>

        <SectionDivider title="Other" />

        <div className="col-span-full">
          <FieldLabel>Other Details</FieldLabel>
          <FTextarea value={form.other_details} onChange={set('other_details')} placeholder="Additional notes…" rows={3} readOnly={readOnly} />
        </div>

        <div>
          <FieldLabel>Status</FieldLabel>
          <FSelect value={form.status} onChange={set('status')} readOnly={readOnly}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </FSelect>
        </div>
      </>}

      {!showFinancials && (
        <div>
          <FieldLabel>Status</FieldLabel>
          <FSelect value={form.status} onChange={set('status')} readOnly={readOnly}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </FSelect>
        </div>
      )}

    </div>
  );
}
