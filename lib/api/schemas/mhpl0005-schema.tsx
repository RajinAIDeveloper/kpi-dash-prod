// lib/api/schemas/mhpl0005-schema.ts
import { z } from 'zod'

const ConsultantSchema = z.object({
  consultant_name: z.string(),
  service_type: z.string(),
  total_revenue: z.number(),
  total_visits: z.number(),
  average_revenue_per_visit: z.number(),
  revenue_percentage: z.number()
})

const PaginationSchema = z.object({
  page_number: z.number(),
  page_size: z.number(),
  total_records: z.number(),
  total_page: z.number()
})

const DayRevenueSchema = z.object({
  date: z.string(),
  total_revenue: z.number(),
  total_visits: z.number(),
  average_revenue_per_visit: z.number()
})

const DataSchema = z.object({
  groupByConsultant: z.array(z.object({
    ...PaginationSchema.shape,
    items: z.array(ConsultantSchema)
  })),
  groupByDay: z.array(z.object({
    ...PaginationSchema.shape,
    items: z.array(DayRevenueSchema)
  }))
})

const InputParametersSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  service_types: z.array(z.string()),
  consultants: z.array(z.string())
})

export const MHPL0005ResponseSchema = z.object({
  status: z.literal('success'),
  code: z.number(),
  input_parameters: InputParametersSchema,
  data: DataSchema
})

export type MHPL0005Response = z.infer<typeof MHPL0005ResponseSchema>
export type Consultant = z.infer<typeof ConsultantSchema>

export function validateMHPL0005Response(data: unknown): MHPL0005Response {
  return MHPL0005ResponseSchema.parse(data)
}
