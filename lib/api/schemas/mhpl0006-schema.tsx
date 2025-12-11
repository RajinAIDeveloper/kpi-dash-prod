// lib/api/schemas/mhpl0006-schema.ts
import { z } from 'zod'

const InsuranceProviderSchema = z.object({
  insurance_provider: z.string(),
  claim_count: z.number(),
  claimed_amount: z.number(),
  average_claim_amount: z.number(),
  pending_receivable: z.number(),
  claim_percentage: z.number()
})

const PaginationSchema = z.object({
  page_number: z.number(),
  page_size: z.number(),
  total_records: z.number(),
  total_pages: z.number()
})

const MonthlyClaimSchema = z.object({
  month: z.string(),
  total_claims: z.number(),
  total_claimed_amount: z.number(),
  average_claim_amount: z.number()
})

const DataSchema = z.object({
  groupByInsuranceProvider: z.array(z.object({
    ...PaginationSchema.shape,
    items: z.array(InsuranceProviderSchema)
  })),
  groupByMonth: z.array(z.object({
    ...PaginationSchema.shape,
    items: z.array(MonthlyClaimSchema)
  }))
})

const InputParametersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  insuranceProviders: z.array(z.string()),
  page_number: z.number(),
  page_size: z.number()
})

export const MHPL0006ResponseSchema = z.object({
  status: z.literal('success'),
  code: z.number(),
  inputParameters: InputParametersSchema,
  data: DataSchema
})

export type MHPL0006Response = z.infer<typeof MHPL0006ResponseSchema>
export type InsuranceProvider = z.infer<typeof InsuranceProviderSchema>

export function validateMHPL0006Response(data: unknown): MHPL0006Response {
  return MHPL0006ResponseSchema.parse(data)
}
