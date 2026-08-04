import { z } from 'zod';

const finiteNonNegative = z.coerce.number().finite().nonnegative();
const optionalNonNegative = finiteNonNegative.optional().default(0);
const optionalString = z.string().optional().default('');
const booleanValue = z.preprocess((value) => {
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return value;
}, z.boolean());

export const deviceParamsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('device_quotas'),
    data: z.object({
      category: z.string().trim().min(1), name: z.string().trim().min(1),
      brand: optionalString, model: optionalString, specification: optionalString,
      maintenance_tier: z.string().optional().default('C档'),
      annual_fault_count: optionalNonNegative, a_gear_fault_count: optionalNonNegative,
      b_gear_fault_count: optionalNonNegative, c_gear_fault_count: optionalNonNegative,
      d_gear_fault_count: optionalNonNegative, e_gear_fault_count: optionalNonNegative,
      fault_processing_days: optionalNonNegative, inspection_days: optionalNonNegative,
      on_site_count: optionalNonNegative, inspection_labor_fee: optionalNonNegative,
      visit_service_fee: optionalNonNegative, traffic_fee: optionalNonNegative,
      fault_handling_fee: optionalNonNegative, tool_amortization: optionalNonNegative,
      consumable_fee: optionalNonNegative, spare_part_reserve: optionalNonNegative,
      spare_part_fee: optionalNonNegative,
    }),
  }),
  z.object({
    type: z.literal('self_construction_quotas'),
    data: z.object({
      id: z.string().trim().min(1), category: z.string().trim().min(1),
      name: z.string().trim().min(1), unit: z.string().trim().min(1),
      quantity: finiteNonNegative.optional().default(1), price: finiteNonNegative,
      remark: optionalString, sort_order: z.coerce.number().int().nonnegative().optional().default(0),
    }),
  }),
  z.object({
    type: z.literal('intelligent_project_quotas'),
    data: z.object({
      id: z.string().trim().min(1), category: z.string().trim().min(1),
      name: z.string().trim().min(1), unit: z.string().trim().min(1), price: finiteNonNegative,
      serial_number: z.coerce.number().int().nonnegative().optional().default(0),
      brand_model: optionalString, description: optionalString,
      deductible_tax_rate: optionalNonNegative, remark: optionalString,
      sort_order: z.coerce.number().int().nonnegative().optional().default(0),
    }),
  }),
  z.object({
    type: z.literal('labor_price_config'),
    data: z.object({
      level: z.string().trim().min(1), unit_price: finiteNonNegative,
      unit: z.string().optional().default('人天'), description: optionalString,
      sort_order: z.coerce.number().int().nonnegative().optional().default(0),
      is_active: booleanValue.optional().default(true),
    }),
  }),
  z.object({
    type: z.literal('maintenance_device_quotas'),
    data: z.object({
      id: z.string().optional(), name: z.string().trim().min(1), brand: optionalString,
      model: optionalString, specification: optionalString, category: optionalString,
      unit: z.string().optional().default('台'), quantity: finiteNonNegative.optional().default(1),
      original_price: optionalNonNegative, maintenance_rate: optionalNonNegative,
      annual_fee: optionalNonNegative, network_type: z.string().optional().default('内网'),
      remark: optionalString, sort_order: z.coerce.number().int().nonnegative().optional().default(0),
      is_active: booleanValue.optional().default(true),
    }),
  }),
  z.object({
    type: z.literal('maintenance_rate_config'),
    data: z.object({
      device_type: z.string().trim().min(1), maintenance_rate: optionalNonNegative,
      description: optionalString,
    }),
  }),
  z.object({
    type: z.literal('sla_config'),
    data: z.object({
      sla_level: z.string().trim().min(1), response_time: optionalNonNegative,
      resolution_time: optionalNonNegative, penalty_rate: optionalNonNegative,
      description: optionalString,
    }),
  }),
]);
