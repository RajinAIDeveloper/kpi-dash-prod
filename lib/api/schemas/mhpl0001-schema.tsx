// lib/api/schemas/mhpl0001-schema.ts
import { z } from 'zod'

const PatientSchema = z.object({
  PATIENT_ID: z.number(),
  PATIENT_NAME: z.string().nullable(),
  LAST_VISIT_DATE: z.string().nullable(),
  REVISIT_COUNT: z.number().nullable()
})

const PatientListSchema = z.object({
  PAGE_NUMBER: z.number(),
  PAGE_SIZE: z.number(),
  TOTAL_RECORDS: z.number(),
  TOTAL_PAGE: z.number(),
  PATIENTS: z.array(PatientSchema)
})

const GroupByMonthSchema = z.object({
  MONTH: z.string(),
  PATIENT_CATEGORY: z.string(),
  REVISIT_COUNT: z.number(),
  UNIQUE_PATIENT: z.number(),
  REVISIT_RATE: z.number(),
  UNIQUE_PATIENT_LIST: z.array(PatientListSchema)
})

const GroupByPatientCategorySchema = z.object({
  PATIENT_CATEGORY: z.string(),
  REVISIT_COUNT: z.number(),
  UNIQUE_PATIENT: z.number(),
  REVISIT_RATE: z.number(),
  UNIQUE_PATIENT_LIST: z.array(PatientListSchema)
})

const GroupByYearSchema = z.object({
  YEAR: z.number(),
  REVISIT_COUNT: z.number(),
  UNIQUE_PATIENT: z.number(),
  REVISIT_RATE: z.number(),
  UNIQUE_PATIENT_LIST: z.array(PatientListSchema)
})

const TotalsSchema = z.object({
  TOTAL_REVISIT_COUNT: z.number(),
  TOTAL_UNIQUE_PATIENTS: z.number(),
  AVERAGE_REVISIT_RATE: z.number()
})

const DataSchema = z.object({
  groupByMonth: z.array(GroupByMonthSchema),
  groupByPatientCategory: z.array(GroupByPatientCategorySchema),
  groupByYear: z.array(GroupByYearSchema),
  totals: z.array(TotalsSchema)
})

const InputParametersSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  patient_categories: z.array(z.string()),
  page_number: z.number(),
  page_size: z.number()
})

export const MHPL0001ResponseSchema = z.object({
  status: z.literal('success'),
  code: z.string(),
  input_parameters: InputParametersSchema,
  data: DataSchema
})

export type MHPL0001Response = z.infer<typeof MHPL0001ResponseSchema>
export type Patient = z.infer<typeof PatientSchema>
export type GroupByMonth = z.infer<typeof GroupByMonthSchema>
export type GroupByCategory = z.infer<typeof GroupByPatientCategorySchema>
export type GroupByYear = z.infer<typeof GroupByYearSchema>

export function validateMHPL0001Response(data: unknown): MHPL0001Response {
  return MHPL0001ResponseSchema.parse(data)
}
