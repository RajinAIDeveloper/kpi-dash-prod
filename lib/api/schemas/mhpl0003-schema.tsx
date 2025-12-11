// lib/api/schemas/mhpl0003-schema.ts
import { z } from 'zod'

const PatientSchema = z.object({
  PATIENT_ID: z.number(),
  PATIENT_NAME: z.string().nullable(),
  LAST_VISIT_DATE: z.string().nullable()
})

const PatientListSchema = z.object({
  PAGE_NUMBER: z.number(),
  PAGE_SIZE: z.number(),
  TOTAL_RECORDS: z.number(),
  TOTAL_PAGES: z.number(),
  PATIENTS: z.array(PatientSchema)
})

const DistrictSchema = z.object({
  DISTRICT: z.string(),
  PATIENT_TYPE: z.string(),
  PATIENT_COUNT: z.number(),
  PERCENTAGE: z.number(),
  PATIENTS_LIST: z.array(PatientListSchema)
})

const LocationSchema = z.object({
  DIVISION: z.string(),
  DISTRICTS: z.array(DistrictSchema)
})

const DataSchema = z.object({
  groupByLocation: z.array(LocationSchema)
})

const InputParametersSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  patient_categories: z.string(),
  district: z.array(z.nullable(z.string())),
  page_number: z.number(),
  page_size: z.number()
})

export const MHPL0003ResponseSchema = z.object({
  status: z.literal('success'),
  code: z.string(),
  input_parameters: InputParametersSchema,
  data: DataSchema
})

export type MHPL0003Response = z.infer<typeof MHPL0003ResponseSchema>
export type Patient = z.infer<typeof PatientSchema>
export type District = z.infer<typeof DistrictSchema>
export type Location = z.infer<typeof LocationSchema>

export function validateMHPL0003Response(data: unknown): MHPL0003Response {
  return MHPL0003ResponseSchema.parse(data)
}
