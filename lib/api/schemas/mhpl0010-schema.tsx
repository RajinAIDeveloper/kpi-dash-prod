// lib/api/schemas/mhpl0010-schema.ts
import { z } from 'zod'

const PaginationSchema = z.object({
  page_number: z.number(),
  page_size: z.number(),
  total_records: z.number(),
  total_pages: z.number()
})

const EmployeeSchema = z.object({
  EMPLOYEE_ID: z.number(),
  EMPLOYEE_NAME: z.string(),
  DEPARTMENT: z.string(),
  EMPLOYEE_TYPE: z.string(),
  TOTAL_SALARY: z.number()
})

const DepartmentSummarySchema = z.object({
  DEPARTMENT: z.string(),
  TOTAL_SALARY: z.number(),
  EMPLOYEE_COUNT: z.number()
})

const EmployeeTypeSummarySchema = z.object({
  EMPLOYEE_TYPE: z.string(),
  TOTAL_SALARY: z.number(),
  EMPLOYEE_COUNT: z.number()
})

const MonthlySalarySchema = z.object({
  month: z.string(),
  TOTAL_SALARY: z.number()
})

const YearlySalarySchema = z.object({
  month: z.string(), // Actually year in "2025" format
  TOTAL_SALARY: z.number()
})

const TotalsSchema = z.object({
  ...PaginationSchema.shape,
  items: z.array(z.object({
    EMPLOYEE_ID: z.number(),
    TOTAL_SALARY: z.number(),
    EMPLOYEE_NAME: z.string()
  })),
  overall_salary: z.number(),
  total_employees: z.number()
})

const DataSchema = z.object({
  totals: TotalsSchema,
  groupByYear: z.object({
    items: z.array(YearlySalarySchema)
  }),
  groupByMonth: z.object({
    items: z.array(MonthlySalarySchema)
  }),
  GroupByEmployee: z.object({
    ...PaginationSchema.shape,
    items: z.array(EmployeeSchema)
  }),
  groupByDepartment: z.object({
    items: z.array(DepartmentSummarySchema)
  }),
  groupByEmployeeType: z.object({
    items: z.array(EmployeeTypeSummarySchema)
  })
})

const InputParametersSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  departments: z.string(),
  employee_type: z.string(),
  page_number: z.number(),
  page_size: z.number()
})

export const MHPL0010ResponseSchema = z.object({
  status: z.literal('success'),
  input_parameters: InputParametersSchema,
  data: DataSchema
})

export type MHPL0010Response = z.infer<typeof MHPL0010ResponseSchema>
export type EmployeeSalary = z.infer<typeof EmployeeSchema>
export type DepartmentSummary = z.infer<typeof DepartmentSummarySchema>
export type EmployeeTypeSummary = z.infer<typeof EmployeeTypeSummarySchema>
export type MonthlySalary = z.infer<typeof MonthlySalarySchema>
export type YearlySalary = z.infer<typeof YearlySalarySchema>

export function validateMHPL0010Response(data: unknown): MHPL0010Response {
  return MHPL0010ResponseSchema.parse(data)
}
