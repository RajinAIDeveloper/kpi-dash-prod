// lib/api/schemas/mhpl0004-schema.ts
import { z } from 'zod'

const PatientSchema = z.object({
  PATIENT_ID: z.number(),
  PATIENT_NAME: z.string().nullable(),
  LAST_VISIT_DATE: z.string().nullable(),
  TOTAL_SPENT: z.number()
})

const PatientListSchema = z.object({
  PAGE_NUMBER: z.number(),
  PAGE_SIZE: z.number(),
  TOTAL_RECORDS: z.number(),
  TOTAL_PAGES: z.number(),
  PATIENTS: z.array(PatientSchema)
})

const SpendingCategorySchema = z.object({
  SPENDING_CATEGORY: z.string(),
  PATIENT_COUNT: z.number(),
  TOTAL_BILLED_AMOUNT: z.number(),
  AVERAGE_SPENT: z.number(),
  PATIENTS_LIST: z.array(PatientListSchema)
})

const MonthlySpendingSchema = z.object({
  MONTH: z.string(),
  SPENDING_CATEGORY: z.string(),
  PATIENT_COUNT: z.number(),
  TOTAL_BILLED_AMOUNT: z.number(),
  AVERAGE_SPENT: z.number()
})

const YearlySpendingSchema = z.object({
  YEAR: z.string(),
  SPENDING_CATEGORY: z.string(),
  PATIENT_COUNT: z.number(),
  TOTAL_BILLED_AMOUNT: z.number(),
  AVERAGE_SPENT: z.number()
})

const TotalsSchema = z.object({
  TOTAL_PATIENTS: z.number(),
  TOTAL_BILLED_AMOUNT: z.number(),
  AVERAGE_SPENT: z.number(),
  PATIENTS_LIST: z.array(PatientListSchema)
})

const DataSchema = z.object({
  groupBySpendingCategory: z.array(SpendingCategorySchema),
  groupByMonth: z.array(MonthlySpendingSchema),
  groupByYear: z.array(YearlySpendingSchema),
  totals: z.array(TotalsSchema)
})

const InputParametersSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  patient_type: z.array(z.string()),
  spending_categories: z.array(z.nullable(z.string()))
})

export const MHPL0004ResponseSchema = z.object({
  status: z.literal('success'),
  Code: z.string(),
  input_parameters: InputParametersSchema,
  data: DataSchema
})

export type MHPL0004Response = z.infer<typeof MHPL0004ResponseSchema>
export type Patient = z.infer<typeof PatientSchema>
export type SpendingCategory = z.infer<typeof SpendingCategorySchema>
export type MonthlySpending = z.infer<typeof MonthlySpendingSchema>

export function validateMHPL0004Response(data: unknown): MHPL0004Response {
  return MHPL0004ResponseSchema.parse(data)
}
