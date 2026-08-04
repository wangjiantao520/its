import type { QuoteSource } from './quote-summary';

const NUMERIC_18_2_MAX_CENTS = BigInt('999999999999999999');
type FieldKind = 'plain' | 'jsonb' | 'numeric18_2';
interface RestoreFieldSpec { column: string; keys: readonly string[]; kind?: FieldKind }

const COMMON_FIELDS: readonly RestoreFieldSpec[] = [
  { column: 'project_name', keys: ['projectName', 'project_name'] },
  { column: 'client_name', keys: ['clientName', 'client_name'] },
  { column: 'status', keys: ['status'] },
  { column: 'contact_person', keys: ['contactPerson', 'contact_person'] },
  { column: 'contact_phone', keys: ['contactPhone', 'contact_phone'] },
];
const QUOTE_VERSION_RESTORE_FIELDS: Record<QuoteSource, readonly RestoreFieldSpec[]> = {
  quotation: [
    ...COMMON_FIELDS,
    { column: 'total_amount', keys: ['total', 'totalAmount', 'total_amount'], kind: 'numeric18_2' },
    { column: 'quote_data', keys: ['quoteData', 'quote_data'], kind: 'jsonb' },
  ],
  engineering: [
    ...COMMON_FIELDS,
    { column: 'construction_area', keys: ['constructionArea', 'construction_area'] },
    { column: 'management_rate', keys: ['managementRate', 'management_rate'] },
    { column: 'profit_rate', keys: ['profitRate', 'profit_rate'] },
    { column: 'regulatory_rate', keys: ['regulatoryRate', 'regulatory_rate'] },
    { column: 'tax_rate', keys: ['taxRate', 'tax_rate'] },
    { column: 'subtotal', keys: ['subtotal'], kind: 'numeric18_2' },
    { column: 'management_fee', keys: ['managementFee', 'management_fee'], kind: 'numeric18_2' },
    { column: 'profit', keys: ['profit'], kind: 'numeric18_2' },
    { column: 'regulatory_fee', keys: ['regulatoryFee', 'regulatory_fee'], kind: 'numeric18_2' },
    { column: 'tax', keys: ['tax'], kind: 'numeric18_2' },
    { column: 'total', keys: ['total'], kind: 'numeric18_2' },
    { column: 'items', keys: ['items'], kind: 'jsonb' },
  ],
  maintenance: [
    ...COMMON_FIELDS,
    { column: 'region', keys: ['region'] },
    { column: 'service_years', keys: ['serviceYears', 'service_years'] },
    { column: 'engineer_level', keys: ['engineerLevel', 'engineer_level'] },
    { column: 'sla_config', keys: ['slaConfig', 'sla_config'], kind: 'jsonb' },
    { column: 'subtotal_before_discount', keys: ['subtotalBeforeDiscount', 'subtotal_before_discount'], kind: 'numeric18_2' },
    { column: 'sla_adjustment', keys: ['slaAdjustment', 'sla_adjustment'], kind: 'numeric18_2' },
    { column: 'region_adjustment', keys: ['regionAdjustment', 'region_adjustment'], kind: 'numeric18_2' },
    { column: 'subtotal_after_coefficients', keys: ['subtotalAfterCoefficients', 'subtotal_after_coefficients'], kind: 'numeric18_2' },
    { column: 'years_discount', keys: ['yearsDiscount', 'years_discount'] },
    { column: 'bulk_discount', keys: ['bulkDiscount', 'bulk_discount'] },
    { column: 'years_discount_amount', keys: ['yearsDiscountAmount', 'years_discount_amount'], kind: 'numeric18_2' },
    { column: 'bulk_discount_amount', keys: ['bulkDiscountAmount', 'bulk_discount_amount'], kind: 'numeric18_2' },
    { column: 'tax', keys: ['tax'], kind: 'numeric18_2' },
    { column: 'total', keys: ['total'], kind: 'numeric18_2' },
    { column: 'devices', keys: ['devices'], kind: 'jsonb' },
  ],
};
const NUMERIC_18_2_FIELDS = new Set(
  Object.values(QUOTE_VERSION_RESTORE_FIELDS).flatMap((fields) => fields.filter((field) => field.kind === 'numeric18_2').flatMap((field) => field.keys)),
);

function canonicalNumeric18_2(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  const text = String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (cents > NUMERIC_18_2_MAX_CENTS) return null;
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`;
}

export function normalizeQuoteVersionSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> | null {
  const normalized = { ...snapshot };
  for (const field of NUMERIC_18_2_FIELDS) {
    if (!(field in normalized)) continue;
    const canonical = canonicalNumeric18_2(normalized[field]);
    if (canonical === null) return null;
    normalized[field] = canonical;
  }
  return normalized;
}

export interface QuoteVersionRestoreField { column: string; value: unknown; jsonb: boolean }

export function quoteVersionRestoreFields(source: QuoteSource, snapshot: Record<string, unknown>): QuoteVersionRestoreField[] {
  return QUOTE_VERSION_RESTORE_FIELDS[source].flatMap((field) => {
    const key = field.keys.find((candidate) => candidate in snapshot);
    return key ? [{ column: field.column, value: snapshot[key], jsonb: field.kind === 'jsonb' }] : [];
  });
}
