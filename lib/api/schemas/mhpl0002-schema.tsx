// lib/api/schemas/mhpl0002-schema.ts
import { z } from 'zod'

const DepartmentExpenseSchema = z.object({
  dept_name: z.string().nullable(),
  total_expense: z.number().nullable(),
  overtime_percentage: z.number().nullable(),
  high_overtime_alert: z.string().nullable(),
  categories: z.array(z.object({
    category: z.string().nullable(),
    amount: z.number().nullable()
  })).nullable()
})

const PeriodExpenseSchema = z.object({
  periods: z.string().nullable(),
  total_expense: z.number().nullable(),
  overtime_percentage: z.number().nullable(),
  high_overtime_alert: z.string().nullable(),
  contractor_expense_change: z.number().nullable(),
  contractor_expense_decrease_alert: z.string().nullable(),
  departments: z.object({
    page_number: z.number().nullable(),
    page_size: z.number().nullable(),
    total_records: z.number().nullable(),
    total_pages: z.number().nullable(),
    items: z.array(DepartmentExpenseSchema).nullable()
  })
})

const SummaryByPeriodSchema = z.object({
  monthly: z.object({
    page_number: z.number().nullable(),
    page_size: z.number().nullable(),
    total_records: z.number().nullable(),
    total_pages: z.number().nullable(),
    items: z.array(PeriodExpenseSchema).nullable()
  }),
  quarterly: z.object({
    page_number: z.number().nullable(),
    page_size: z.number().nullable(),
    total_records: z.number().nullable(),
    total_pages: z.number().nullable(),
    items: z.array(PeriodExpenseSchema).nullable()
  }),
  yearly: z.object({
    page_number: z.number().nullable(),
    page_size: z.number().nullable(),
    total_records: z.number().nullable(),
    total_pages: z.number().nullable(),
    items: z.array(PeriodExpenseSchema).nullable()
  })
})

const TotalsSchema = z.object({
  grand_total_expense: z.number().nullable(),
  total_salary: z.number().nullable(),
  total_allowance: z.number().nullable(),
  total_overtime: z.number().nullable(),
  total_bonus: z.number().nullable(),
  total_contractor_expense: z.number().nullable(),
  average_expense_per_period: z.number().nullable(),
  overall_overtime_percentage: z.number().nullable(),
  page_number: z.number().nullable(),
  page_size: z.number().nullable(),
  total_records: z.number().nullable(),
  total_pages: z.number().nullable(),
  items: z.array(z.object({
    period: z.string().nullable(),
    total_expense: z.number().nullable()
  })).nullable()
})

const DataSchema = z.object({
  summaryByPeriod: SummaryByPeriodSchema,
  totals: TotalsSchema
})

const InputParametersSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  page_number: z.number().nullable(),
  page_size: z.number().nullable()
})

export const MHPL0002ResponseSchema = z.object({
  status: z.literal('success'),
  input_parameters: InputParametersSchema,
  data: DataSchema
})

export type MHPL0002Response = z.infer<typeof MHPL0002ResponseSchema>
export type PeriodExpense = z.infer<typeof PeriodExpenseSchema>
export type DepartmentExpense = z.infer<typeof DepartmentExpenseSchema>

export function validateMHPL0002Response(data: unknown): MHPL0002Response {
  return MHPL0002ResponseSchema.parse(data)
}
