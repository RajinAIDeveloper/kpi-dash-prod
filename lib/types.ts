// lib/types.ts

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  source: string;
  data: any;
  timestamp: Date;
}

export interface KPICard {
  id: string;
  title: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down';
  apiSource: string;
  detailRoute: string;
  hoverData: Record<string, any>;
  inputParameters?: Record<string, any>;
  calculation?: string;
}

export interface BedOccupancyData {
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  occupancy_rate: number;
}

export interface PatientRevisitData {
  TOTAL_UNIQUE_PATIENTS: number;
  TOTAL_REVISIT_COUNT: number;
  AVERAGE_REVISIT_RATE: number;
}

export interface ConsultantRevenueData {
  total_revenue: number;
  total_consultants: number;
  total_visits: number;
  average_revenue_per_visit: number;
}

export interface EmployeeAttendanceData {
  total_employees: number;
  overall_average_present_days: number;
  overall_average_performance_score: number;
}

export interface InsuranceData {
  total_claim_count: number;
  total_claimed_amount: number;
  total_pending_receivable: number;
  average_claim_amount: number;
}

export interface PatientSpendingData {
  TOTAL_PATIENTS: number;
  TOTAL_BILLED_AMOUNT: number;
  AVERAGE_SPENT: number;
}

export interface MedicineWasteData {
  total_expired_quantity: number;
  total_wasted_quantity: number;
  total_expired_value: number;
  total_wasted_value: number;
  total_loss_value: number;
  total_loss_quantity: number;
  loss_percentage: number;
}

export interface DemographicsData {
  DIVISION: string;
  DISTRICTS: Array<{
    DISTRICT: string;
    PATIENT_COUNT: number;
    PERCENTAGE: number;
  }>;
}

export interface PayrollData {
  grand_total_expense: number;
  total_salary: number;
  total_allowance: number;
  average_expense_per_period: number;
  overall_overtime_percentage: number;
}

export interface ComparisonPeriod {
  type: 'week' | 'month' | 'year';
  current: DateRange;
  previous: DateRange;
}

export interface DrillDownModalState {
  isOpen: boolean;
  type: string;
  data: any;
  title: string;
}