// lib/api/schemas/mhpl0009-schema.tsx
import { z } from 'zod'

const PaginationSchema = z.object({
  page_number: z.number(),
  page_size: z.number(),
  total_records: z.number(),
  total_pages: z.number()
})

// totals.items array structure
const TotalItemSchema = z.object({
  reason: z.string(),
  value: z.number(),
  quantity: z.number(),
  percentage_of_total_loss: z.number()
})

// totals object structure
const TotalsSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(TotalItemSchema),
  total_loss_value: z.number(),
  total_wasted_value: z.number(),
  total_expired_value: z.number(),
  total_loss_quantity: z.number(),
  total_wasted_quantity: z.number(),
  total_expired_quantity: z.number(),
  total_loss_percentage: z.number()
})

// groupByYear items structure
const YearlyWasteSchema = z.object({
  year: z.string(),
  total_value: z.number(),
  total_quantity: z.number(),
  total_wasted_value: z.number(),
  total_expired_value: z.number(),
  total_wasted_quantity: z.number(),
  total_expired_quantity: z.number(),
  percentage_of_total_loss: z.number()
})

// groupByMonth items structure
const MonthlyWasteSchema = z.object({
  month: z.string(),
  total_value: z.number(),
  total_quantity: z.number(),
  total_wasted_value: z.number(),
  total_expired_value: z.number(),
  total_wasted_quantity: z.number(),
  total_expired_quantity: z.number(),
  percentage_of_total_loss: z.number()
})

// groupByReason items structure
const ReasonSchema = z.object({
  reason: z.string(),
  total_value: z.number(),
  total_quantity: z.number(),
  percentage_of_total_loss: z.number()
})

// groupByCategory items structure
const CategorySchema = z.object({
  category: z.string(),
  total_value: z.number(),
  total_quantity: z.number(),
  total_wasted_value: z.number(),
  total_expired_value: z.number(),
  total_wasted_quantity: z.number(),
  total_expired_quantity: z.number(),
  percentage_of_total_loss: z.number()
})

// groupByMedicines items structure
const MedicineSchema = z.object({
  medicine_name: z.string(),
  category: z.string(),
  total_value: z.number(),
  total_quantity: z.number(),
  wasted_value: z.number(),
  expired_value: z.number(),
  wasted_quantity: z.number(),
  expired_quantity: z.number(),
  percentage_of_total_loss: z.number()
})

const DataSchema = z.object({
  totals: TotalsSchema,
  groupByYear: z.object({
    ...PaginationSchema.shape,
    items: z.array(YearlyWasteSchema)
  }),
  groupByMonth: z.object({
    ...PaginationSchema.shape,
    items: z.array(MonthlyWasteSchema)
  }),
  groupByReason: z.object({
    ...PaginationSchema.shape,
    items: z.array(ReasonSchema)
  }),
  groupByCategory: z.object({
    ...PaginationSchema.shape,
    items: z.array(CategorySchema)
  }),
  groupByMedicines: z.object({
    ...PaginationSchema.shape,
    items: z.array(MedicineSchema)
  })
})

const InputParametersSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  medicine_categories: z.array(z.string()),
  medicine_name: z.string(),
  page_number: z.number(),
  page_size: z.number()
})

export const MHPL0009ResponseSchema = z.object({
  status: z.literal('success'),
  code: z.number(),
  inputParameters: InputParametersSchema,
  data: DataSchema
})

export type MHPL0009Response = z.infer<typeof MHPL0009ResponseSchema>
export type Medicine = z.infer<typeof MedicineSchema>
export type MonthlyWaste = z.infer<typeof MonthlyWasteSchema>
export type YearlyWaste = z.infer<typeof YearlyWasteSchema>
export type ReasonWise = z.infer<typeof ReasonSchema>
export type CategoryWise = z.infer<typeof CategorySchema>
export type TotalItem = z.infer<typeof TotalItemSchema>

export function validateMHPL0009Response(data: unknown): MHPL0009Response {
  return MHPL0009ResponseSchema.parse(data)
}
