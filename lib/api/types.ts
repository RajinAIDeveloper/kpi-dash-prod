// MHPL API Types and Interfaces

export interface MHPLResponse<T = any> {
  status: 'success' | 'error'
  code: string
  message: string
  data?: T
  input_parameters?: Record<string, any>
  totalRecords?: number
  total_records?: number
  pageInfo?: {
    currentPage: number
    [key: string]: any
  }
}

export interface MHPLEndpoint {
  id: string
  name: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  description: string
}

// Patient data types
export interface Patient {
  id: number
  name: string
  admission_date: string
  department: string
  patient_category?: string
  spending_category?: string
}

export interface PatientAdmissionData {
  patients: Patient[]
  total_count: number
  page: number
  page_size: number
}

// Department data types
export interface Department {
  name: string
  patient_count: number
}

export interface DepartmentData {
  departments: Department[]
  total_departments: number
}

// Spending analysis types
export interface SpendingCategory {
  category: 'LOW' | 'MEDIUM' | 'HIGH'
  count: number
  avg_amount: number
}

export interface SpendingAnalysis {
  spending_analysis: SpendingCategory[]
  total_patients: number
}

// Medicine loss types
export interface MedicineLoss {
  medicine: string
  lost_quantity: number
  value: number
}

export interface MedicineLossData {
  medicine_loss: MedicineLoss[]
  total_loss_value: number
}

// Bed occupancy types
export interface BedOccupancy {
  total_beds: number
  occupied_beds: number
  occupancy_rate: number
  threshold: number
  status: 'BELOW_THRESHOLD' | 'AT_THRESHOLD' | 'ABOVE_THRESHOLD'
}

export interface BedOccupancyData {
  bed_occupancy: BedOccupancy
}

// Employee performance types
export interface Employee {
  employee_id: string
  name: string
  performance_score: number
}

export interface DepartmentPerformance {
  department: string
  avg_score: number
}

export interface EmployeeTypePerformance {
  type: string
  avg_score: number
}

export interface MonthlyPerformance {
  month: string
  avg_score: number
}

export interface YearlyPerformance {
  year: string
  avg_score: number
}

export interface EmployeePerformanceData {
  GroupByEmployee: Employee[]
  groupByDepartment: DepartmentPerformance[]
  groupByEmployeeType: EmployeeTypePerformance[]
  groupByMonth: MonthlyPerformance[]
  groupByYear: YearlyPerformance[]
}

// API parameter types
export interface PaginationParams {
  PageSize?: string
  PageNumber?: string
  Page_Size?: string  // Alternative format for some endpoints
  Page_Number?: string // Alternative format for some endpoints
}

export interface DateRangeParams {
  StartDate?: string
  EndDate?: string
}

export interface FilterParams {
  PatCat?: string
  SpendCat?: string
  Dept?: string
  EmpType?: string
  SummType?: string
  Threshold?: string
  ServiceTypes?: string
  MedicineCategory?: string
  GroupBy?: string
  SortBy?: string
  FilterBy?: string
}

export type MHPLParams = PaginationParams & DateRangeParams & FilterParams

// Error types
export interface MHPLError {
  code: string
  message: string
  details?: any
}

// Authentication types
export interface AuthToken {
  token: string
  expires_at?: string
  issued_at?: string
}

export interface AuthResponse {
  success: boolean
  token?: string
  error?: string
  message?: string
}