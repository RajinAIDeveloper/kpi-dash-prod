// lib/api/schemas/mhpl0007-schema.ts
import { z } from 'zod'

const BedDetailSchema = z.object({
  date: z.string(),
  bed_id: z.string(),
  ward: z.string(),
  bed_type: z.string(),
  status: z.string(),
  occupied_by: z.string().nullable(),
  unavailable_reason: z.string().nullable()
})

const AvailableBedSchema = z.object({
  date: z.string(),
  bed_id: z.string(),
  ward: z.string(),
  bed_type: z.string()
})

const TotalItemSchema = z.object({
  ward: z.string(),
  bed_id: z.string(),
  status: z.string(),
  bed_type: z.string()
})

const PaginationSchema = z.object({
  page_number: z.number(),
  page_size: z.number(),
  total_records: z.number(),
  total_pages: z.number()
})

const TotalsSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(TotalItemSchema),
  total_beds: z.number(),
  occupied_beds: z.number(),
  available_beds: z.number(),
  unavailable_beds: z.number(),
  occupancy_rate: z.number()
})

const AlertsSchema = z.object({
  occupancy_below_standard: z.string(),
  threshold: z.number(),
  current_occupancy_rate: z.number(),
  message: z.string()
})

const DataSchema = z.object({
  alerts: AlertsSchema,
  totals: TotalsSchema,
  groupByAvailable: z.object({
    ...PaginationSchema.shape,
    items: z.array(AvailableBedSchema)
  }),
  groupByDateAndBed: z.object({
    ...PaginationSchema.shape,
    items: z.array(BedDetailSchema)
  })
})

const InputParametersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  threshold: z.number(),
  wards: z.array(z.string()),
  bedType: z.array(z.string()),
  page_number: z.number(),
  page_size: z.number()
})

export const MHPL0007ResponseSchema = z.object({
  status: z.literal('success'),
  code: z.number(),
  inputParameters: InputParametersSchema,
  data: DataSchema
})

export type MHPL0007Response = z.infer<typeof MHPL0007ResponseSchema>
export type BedDetail = z.infer<typeof BedDetailSchema>
export type AvailableBed = z.infer<typeof AvailableBedSchema>
export type TotalItem = z.infer<typeof TotalItemSchema>

export function validateMHPL0007Response(data: unknown): MHPL0007Response {
  return MHPL0007ResponseSchema.parse(data)
}
