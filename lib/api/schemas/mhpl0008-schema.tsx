// lib/api/schemas/mhpl0008-schema.ts
import { z } from 'zod'

const EmployeeSchema = z.object({
  employee_id: z.string(),
  employee_name: z.string(),
  department: z.string(),
  designation: z.string(),
  employee_type: z.string(),
  working_days: z.number(),
  present_days: z.number(),
  absent_days: z.number(),
  late_count: z.number(),
  performance_score: z.number()
})

const PaginationSchema = z.object({
  page_number: z.number(),
  page_size: z.number(),
  total_records: z.number(),
  total_pages: z.number()
})

const MonthlyPerformanceSchema = z.object({
  month: z.string().optional(),
  year: z.string().optional(),
  department: z.string(),
  average_performance_score: z.number(),
  total_employees: z.number().optional()
})

const EmployeeGroupSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(EmployeeSchema)
})

const DepartmentPerformanceSchema = z.object({
  department: z.string(),
  total_employees: z.number(),
  average_present_days: z.number(),
  average_performance_score: z.number(),
  employees: z.array(EmployeeGroupSchema)
})

const TotalsSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(EmployeeSchema),
  total_employees: z.number(),
  overall_average_present_days: z.number(),
  overall_average_performance_score: z.number()
})

const DataSchema = z.object({
  totals: z.array(TotalsSchema),
  groupByYear: z.array(z.object({
    ...PaginationSchema.shape,
    items: z.array(MonthlyPerformanceSchema)
  })),
  groupByMonth: z.array(z.object({
    ...PaginationSchema.shape,
    items: z.array(MonthlyPerformanceSchema)
  })),
  groupByEmployee: z.array(EmployeeGroupSchema),
  groupByDepartment: z.array(z.object({
    ...PaginationSchema.shape,
    items: z.array(DepartmentPerformanceSchema)
  }))
})

const InputParametersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  departments: z.array(z.string()),
  employeeTypes: z.array(z.string()),
  page_number: z.number(),
  page_size: z.number()
})

export const MHPL0008ResponseSchema = z.object({
  status: z.literal('success'),
  code: z.number(),
  inputParameters: InputParametersSchema,
  data: DataSchema
})

export type MHPL0008Response = z.infer<typeof MHPL0008ResponseSchema>
export type Employee = z.infer<typeof EmployeeSchema>
export type MonthlyPerformance = z.infer<typeof MonthlyPerformanceSchema>
export type DepartmentPerformance = z.infer<typeof DepartmentPerformanceSchema>
export type EmployeeGroup = z.infer<typeof EmployeeGroupSchema>

export function validateMHPL0008Response(data: unknown): MHPL0008Response {
  return MHPL0008ResponseSchema.parse(data)
}
