'use client';

import {
  FieldLabel, FInput, FTextarea, FSelect,
  ComputedBox, SectionDivider, PayBar,
  BrokerPicker,
  fmtINR, fmtPct,
} from './shared';

export default function PurchaseFormBody({ form, set, setForm, c, readOnly = false }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">

      {/* ── BASIC INFORMATION ─────────────────────────────────── */}
      <SectionDivider title="Basic Information" />

      {/* Purchase Code — always read-only (auto-generated) */}
      {form.purchase_code && (
        <div>
          <FieldLabel>Purchase Code</FieldLabel>
          <div className="min-h-[36px] px-3 py-[7px] bg-[#875A7B]/5 rounded border border-[#875A7B]/20 text-sm font-semibold text-[#875A7B] tracking-wide">
            {form.purchase_code}
          </div>
        </div>
      )}

      <div>
        <FieldLabel>Purchase Category</FieldLabel>
        <FSelect value={form.purchase_category} onChange={set('purchase_category')} readOnly={readOnly}>
          <option value="SINGLE">Single — One plot / shop / unit</option>
          <option value="DIVIDED">Divided — Full land split into sub-units</option>
        </FSelect>
      </div>

      <div>
        <FieldLabel>Type</FieldLabel>
        <FSelect value={form.type} onChange={set('type')} readOnly={readOnly}>
          <option value="PLOT">Plot</option>
          <option value="LAND">Land</option>
          <option value="SHOP">Shop</option>
        </FSelect>
      </div>

      <div>
        <FieldLabel>SL No</FieldLabel>
        <FInput value={form.sl_no} onChange={set('sl_no')} placeholder="e.g. SL-001" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Location</FieldLabel>
        <FInput value={form.location} onChange={set('location')} placeholder="City / Area / Survey No" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Status</FieldLabel>
        <FSelect value={form.status} onChange={set('status')} readOnly={readOnly}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </FSelect>
      </div>

      {/* ── SELLER & BROKER ───────────────────────────────────── */}
      <SectionDivider title="Seller &amp; Broker" />

      <div className="col-span-full">
        <FieldLabel>Seller Details</FieldLabel>
        <FTextarea value={form.seller_details} onChange={set('seller_details')} placeholder="Name, address, contact..." rows={2} readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Purchase Broker Name</FieldLabel>
        {readOnly ? (
          <div className="min-h-[36px] px-3 py-[7px] bg-gray-50 rounded border border-gray-100 text-sm text-gray-700">
            {form.purchase_broker_name || <span className="text-gray-300">—</span>}
          </div>
        ) : (
          <BrokerPicker
            value={form._purchase_broker}
            onPick={(b) => setForm(p => ({ ...p, purchase_broker_name: b.name, _purchase_broker: b }))}
            onClear={() => setForm(p => ({ ...p, purchase_broker_name: '', _purchase_broker: null }))}
          />
        )}
      </div>

      <div>
        <FieldLabel>Purchase Broker Details</FieldLabel>
        <FInput value={form.purchase_broker_details} onChange={set('purchase_broker_details')} placeholder="Contact / commission" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Sell Broker Name</FieldLabel>
        <FInput value={form.sell_broker_name} onChange={set('sell_broker_name')} placeholder="Broker name" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Sell Broker Details</FieldLabel>
        <FInput value={form.sell_broker_details} onChange={set('sell_broker_details')} placeholder="Contact / commission" readOnly={readOnly} />
      </div>

      {/* ── AREA & RATE ───────────────────────────────────────── */}
      <SectionDivider title="Area &amp; Rate" />

      <div>
        <FieldLabel>Purchased Area</FieldLabel>
        <FInput type="number" value={form.purchased_area} onChange={set('purchased_area')} placeholder="0" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Area Unit</FieldLabel>
        <FSelect value={form.purchased_area_details} onChange={set('purchased_area_details')} readOnly={readOnly}>
          <option value="">— Select Unit —</option>
          <option value="sq.ft">sq.ft — Square Feet</option>
          <option value="sq.yd">sq.yd — Square Yards</option>
          <option value="sq.m">sq.m — Square Meters</option>
          <option value="cents">Cents</option>
          <option value="acres">Acres</option>
          <option value="guntas">Guntas</option>
          <option value="bigha">Bigha</option>
          <option value="gaj">Gaj</option>
        </FSelect>
      </div>

      <div>
        <FieldLabel>Plot No</FieldLabel>
        <FInput value={form.plot_no} onChange={set('plot_no')} placeholder="e.g. P-42" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Rate (per unit, ₹)</FieldLabel>
        <FInput type="number" value={form.rate} onChange={set('rate')} placeholder="0" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Rate Details</FieldLabel>
        <FInput value={form.rate_details} onChange={set('rate_details')} placeholder="Per sq.ft / per sq.yd" readOnly={readOnly} />
      </div>

      {/* Computed: Total Amount */}
      <ComputedBox label="Total Amount = Rate × Area" value={fmtINR(c.total_amount)} accent />

      <div>
        <FieldLabel>Total Amount Notes</FieldLabel>
        <FInput value={form.total_amount_details} onChange={set('total_amount_details')} placeholder="Notes or breakdown" readOnly={readOnly} />
      </div>

      {/* ── PAYMENT ───────────────────────────────────────────── */}
      <SectionDivider title="Payment" />

      <div>
        <FieldLabel>Advance Paid (₹)</FieldLabel>
        <FInput type="number" value={form.advance_paid} onChange={set('advance_paid')} placeholder="0" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Advance Payment Details</FieldLabel>
        <FTextarea value={form.advance_payment_details} onChange={set('advance_payment_details')} placeholder="Date, mode, cheque no..." rows={2} readOnly={readOnly} />
      </div>

      {/* Payment checkboxes */}
      <div className="col-span-full flex items-center gap-8 py-1">
        <label className={`flex items-center gap-2.5 cursor-pointer select-none ${readOnly ? 'pointer-events-none' : ''}`}>
          <input
            type="checkbox"
            checked={!!form.remaining_paid}
            onChange={(e) => set('remaining_paid')({ target: { value: e.target.checked } })}
            disabled={readOnly}
            className="w-4 h-4 rounded border-gray-300 accent-[#875A7B]"
          />
          <span className="text-sm font-medium text-gray-700">Pay Remaining in Installments</span>
        </label>
        <label className={`flex items-center gap-2.5 cursor-pointer select-none ${readOnly ? 'pointer-events-none' : ''}`}>
          <input
            type="checkbox"
            checked={!!form.against_registration_paid}
            onChange={(e) => set('against_registration_paid')({ target: { value: e.target.checked } })}
            disabled={readOnly}
            className="w-4 h-4 rounded border-gray-300 accent-[#875A7B]"
          />
          <span className="text-sm font-medium text-gray-700">Against Registration</span>
        </label>
      </div>

      <div className="col-span-full">
        <FieldLabel>Instalment Details</FieldLabel>
        <FTextarea value={form.instalment_details} onChange={set('instalment_details')} placeholder="EMI schedule, dates, amounts..." rows={2} readOnly={readOnly} />
      </div>

      {/* Payment progress bar */}
      <PayBar pct={c.percentage_paid} />

      {/* Computed payment stats */}
      <ComputedBox label="Balance To Pay" value={fmtINR(c.balance_to_pay)} />
      <ComputedBox label="% To Pay" value={fmtPct(c.percentage_to_pay)} />

      {/* ── ADDITIONAL COSTS ─────────────────────────────────── */}
      <SectionDivider title="Additional Costs" />

      <div>
        <FieldLabel>Brokerage (₹)</FieldLabel>
        <FInput type="number" value={form.brokerage} onChange={set('brokerage')} placeholder="0" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Brokerage Details</FieldLabel>
        <FInput value={form.brokerage_details} onChange={set('brokerage_details')} placeholder="Notes" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Extra Expenses (₹)</FieldLabel>
        <FInput type="number" value={form.extra_expenses} onChange={set('extra_expenses')} placeholder="0" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Extra Expenses Details</FieldLabel>
        <FInput value={form.extra_expenses_details} onChange={set('extra_expenses_details')} placeholder="Notes" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Registration Charges (₹)</FieldLabel>
        <FInput type="number" value={form.registration_charges} onChange={set('registration_charges')} placeholder="0" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Registration Charges Details</FieldLabel>
        <FInput value={form.registration_charges_details} onChange={set('registration_charges_details')} placeholder="Notes" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Extra Income (₹)</FieldLabel>
        <FInput type="number" value={form.extra_income} onChange={set('extra_income')} placeholder="0" readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Extra Income Details</FieldLabel>
        <FInput value={form.extra_income_details} onChange={set('extra_income_details')} placeholder="Notes" readOnly={readOnly} />
      </div>

      <div className="col-span-full">
        <ComputedBox
          label="Total Cost = Advance + Brokerage + Extra Expenses + Reg. Charges − Extra Income"
          value={fmtINR(c.total_cost)}
          accent
        />
      </div>

      {/* ── REGISTRATION ─────────────────────────────────────── */}
      <SectionDivider title="Registration" />

      <div>
        <FieldLabel>Registration Date (Purchase)</FieldLabel>
        <FInput type="date" value={form.registration_date} onChange={set('registration_date')} readOnly={readOnly} />
      </div>

      <div>
        <FieldLabel>Registration Details</FieldLabel>
        <FTextarea value={form.registration_details} onChange={set('registration_details')} placeholder="Survey no, document no, notes..." rows={2} readOnly={readOnly} />
      </div>

      {/* ── OTHER ────────────────────────────────────────────── */}
      <SectionDivider title="Other" />

      <div className="col-span-full">
        <FieldLabel>Other Details</FieldLabel>
        <FTextarea value={form.other_details} onChange={set('other_details')} placeholder="Any additional notes..." rows={3} readOnly={readOnly} />
      </div>

    </div>
  );
}
