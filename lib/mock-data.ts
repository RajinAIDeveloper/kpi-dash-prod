// lib/mock-data.ts

import { Alert, BedOccupancyData, PatientRevisitData, ConsultantRevenueData, EmployeeAttendanceData, InsuranceData, PatientSpendingData, MedicineWasteData, DemographicsData, PayrollData } from './types';

export const mockAlerts: Alert[] = [
  {
    id: 'bed-occupancy-1',
    type: 'error',
    title: 'Low Bed Occupancy Alert',
    message: 'Occupancy rate (33.33%) is below the standard threshold (75%). Immediate attention required.',
    source: 'mhpl0007',
    data: { ward: 'LEVEL-12 NURSE STATION', occupancy_rate: 33.33 },
    timestamp: new Date('2025-01-01T10:30:00')
  },
  {
    id: 'overtime-1',
    type: 'warning',
    title: 'High Overtime Alert',
    message: 'MEDICINE department has 15% overtime in 2025-01',
    source: 'mhpl0002',
    data: { department: 'MEDICINE', overtime_percentage: 15 },
    timestamp: new Date('2025-01-01T09:15:00')
  },
  {
    id: 'contractor-1',
    type: 'warning',
    title: 'Contractor Expense Decrease',
    message: 'Contractor expenses decreased by 12% in 2025-Q1',
    source: 'mhpl0002',
    data: { period: '2025-Q1', change: -12 },
    timestamp: new Date('2025-01-01T08:45:00')
  }
];

export const mockAlerts2: Alert[] = [
  {
    id: 'bed-occupancy-1',
    type: 'error',
    title: 'Low Bed Occupancy Alert',
    message: 'Occupancy rate (33.33%) is below the standard threshold (75%). Immediate attention required.',
    source: 'mhpl0007',
    data: { ward: 'LEVEL-12 NURSE STATION', occupancy_rate: 33.33 },
    timestamp: new Date('2025-01-01T10:30:00')
  },
];

export const mockAlertsAdmin: Alert[] = [
  {
    id: 'overtime-1',
    type: 'warning',
    title: 'High Overtime Alert',
    message: 'MEDICINE department has 15% overtime in 2025-01',
    source: 'mhpl0002',
    data: { department: 'MEDICINE', overtime_percentage: 15 },
    timestamp: new Date('2025-01-01T09:15:00')
  },
  {
    id: 'contractor-1',
    type: 'warning',
    title: 'Contractor Expense Decrease',
    message: 'Contractor expenses decreased by 12% in 2025-Q1',
    source: 'mhpl0002',
    data: { period: '2025-Q1', change: -12 },
    timestamp: new Date('2025-01-01T08:45:00')
  }
];

export const mockAlertsPharmacy: Alert[] = [
  {
    id: 'Waste-1',
    type: 'warning',
    title: 'Wasted Value Warning',
    message: 'A total of value of ৳70,698 Wasted Medicine Detected in 2025-Q1',
    source: 'mhpl0002',
    data: { period: '2025-Q1', change: -12 },
    timestamp: new Date('2025-01-01T08:45:00')
  },
  {
    id: 'Expired-1',
    type: 'warning',
    title: 'Expired Value Warning',
    message: 'A total of value of ৳3,566 Expired Medicine Detected in 2025-Q1',
    source: 'mhpl0002',
    data: { period: '2025-Q1', change: -12 },
    timestamp: new Date('2025-01-01T08:45:00')
  },
   {
    id: 'WastedAndExpired-1',
    type: 'warning',
    title: 'Total Expired & Wasted Value Warning',
    message: 'A total of value of ৳3,566 Expired Medicine and ৳70,698 Wasted Medicine Detected. Total value Loss is:৳74,264 in 2025-Q1',
    source: 'mhpl0002',
    data: { period: '2025-Q1', change: -12 },
    timestamp: new Date('2025-01-01T08:45:00')
  }

];

export const mockBedOccupancy: BedOccupancyData = {
  total_beds: 150,
  occupied_beds: 117,
  available_beds: 33,
  occupancy_rate: 78
};

export const mockPatientRevisit: PatientRevisitData = {
  TOTAL_UNIQUE_PATIENTS: 2207,
  TOTAL_REVISIT_COUNT: 218,
  AVERAGE_REVISIT_RATE: 0.099
};

export const mockConsultantRevenue: ConsultantRevenueData = {
  total_revenue: 8007780,
  total_consultants: 147,
  total_visits: 11704,
  average_revenue_per_visit: 684.19
};

export const mockEmployeeAttendance: EmployeeAttendanceData = {
  total_employees: 90,
  overall_average_present_days: 25,
  overall_average_performance_score: 86.6
};

export const mockInsurance: InsuranceData = {
  total_claim_count: 375,
  total_claimed_amount: 10500000,
  total_pending_receivable: 2300000,
  average_claim_amount: 28000
};

export const mockPatientSpending: PatientSpendingData = {
    
  TOTAL_PATIENTS: 235,
  TOTAL_BILLED_AMOUNT: 4230010.2,
  AVERAGE_SPENT: 18010.2
};

export const mockMedicineWaste: MedicineWasteData = {
  total_expired_quantity: 397,
  total_wasted_quantity: 8036,
  total_expired_value: 3565.59,
  total_wasted_value: 70698.02,
  total_loss_value: 74263.61,
  total_loss_quantity: 8433,
  loss_percentage: 30
};

export const mockPayroll: PayrollData = {
  grand_total_expense: 410000,
  total_salary: 320000,
  total_allowance: 180000,
  average_expense_per_period: 3205,
  overall_overtime_percentage: 2.5
};

export const mockDemographics: DemographicsData[] = [
  {
    DIVISION: 'Dhaka',
    DISTRICTS: [
      { DISTRICT: 'Dhaka', PATIENT_COUNT: 239, PERCENTAGE: 97.15 },
      { DISTRICT: 'Madaripur', PATIENT_COUNT: 4, PERCENTAGE: 1.63 },
      { DISTRICT: 'Narsingdi', PATIENT_COUNT: 1, PERCENTAGE: 0.41 }
    ]
  },
  {
    DIVISION: 'Chittagong',
    DISTRICTS: [
      { DISTRICT: 'Chittagong', PATIENT_COUNT: 150, PERCENTAGE: 85.5 },
      { DISTRICT: 'Comilla', PATIENT_COUNT: 25, PERCENTAGE: 14.2 }
    ]
  },

    {
    DIVISION: 'Sylhet',
    
    DISTRICTS: [
      { DISTRICT: 'Sylhet', PATIENT_COUNT: 56, PERCENTAGE: 33 },
      { DISTRICT: 'Moulvibazar', PATIENT_COUNT: 25, PERCENTAGE: 15 },
      { DISTRICT: 'Habiganj', PATIENT_COUNT: 15, PERCENTAGE: 10}
    ]
  },
  {
    DIVISION: 'Rajshahi',
    DISTRICTS: [
      { DISTRICT: 'Rajshahi', PATIENT_COUNT: 37, PERCENTAGE: 23 },
      { DISTRICT: 'Rangpur', PATIENT_COUNT: 19, PERCENTAGE: 12 },
      { DISTRICT: 'Bogura', PATIENT_COUNT: 12, PERCENTAGE: 7 }
    ]
  }
];

export const mockBedOccupancyByWard = [
  { ward: 'ICU', occupied: 18, total: 20, rate: 90, status: 'high' },
  { ward: 'General', occupied: 65, total: 80, rate: 81, status: 'good' },
  { ward: 'Private', occupied: 22, total: 30, rate: 73, status: 'good' },
  { ward: 'Emergency', occupied: 12, total: 15, rate: 80, status: 'good' },
  { ward: 'Maternity', occupied: 8, total: 12, rate: 67, status: 'low' }
];

export const mockRevenueByConsultant = [
  { name: 'Prof. Dr. Nasrin Akhter', revenue: 785400, visits: 740, percentage: 9.81 },
  { name: 'Prof. Dr. Gobinda Chandra Banik', revenue: 727700, visits: 1206, percentage: 9.09 },
  { name: 'EMO', revenue: 1042510, visits: 2005, percentage: 13.02 },
  { name: 'Prof. Dr. Afroza Begum', revenue: 650000, visits: 520, percentage: 8.12 },
  { name: 'Dr. Md. Arif Hossain', revenue: 580000, visits: 480, percentage: 7.24 }
];

export const mockPayrollByDepartment = [
  { department: 'MEDICINE', expense: 120500, employees: 25, overtime: 2.1 },
  { department: 'BILLING', expense: 200000, employees: 18, overtime: 1.8 },
  { department: 'NURSING', expense: 85000, employees: 32, overtime: 3.2 },
  { department: 'PHARMACY', expense: 65000, employees: 12, overtime: 1.5 }
];

export const mockSpendingCategories = [
  { category: 'High (50,000 BDT - 2,00,000 BDT)', patients: 235, amount: 17815397, percentage: 65 },
  { category: 'Medium (20,000 BDT - 50,000 BDT)', patients: 189, amount: 6850000, percentage: 25 },
  { category: 'Low (0 BDT - 20,000 BDT)', patients: 95, amount: 1200000, percentage: 10 }
];

export const mockMedicineWasteByCategory = [
  { category: 'Tablet', expired_value: 1200.50, wasted_value: 15000.25, total: 16200.75 },
  { category: 'Syrup', expired_value: 850.30, wasted_value: 8500.80, total: 9351.10 },
  { category: 'Injection', expired_value: 1515.79, wasted_value: 47197.42, total: 48713.21 }
];

export const mockMonthlyTrends = [
  { month: 'Jan', revenue: 3200000, patients: 1850, expenses: 380000 },
  { month: 'Feb', revenue: 3450000, patients: 1920, expenses: 390000 },
  { month: 'Mar', revenue: 3680000, patients: 2050, expenses: 405000 },
  { month: 'Apr', revenue: 3520000, patients: 1980, expenses: 395000 },
  { month: 'May', revenue: 3980000, patients: 2207, expenses: 410000 },
  { month: 'Jun', revenue: 4200000, patients: 2350, expenses: 425000 }
];

export const mockEmployeePerformance = [
  { id: '2030002', name: 'MD. ISMAIL HOSSAIN', department: 'MEDICINE', attendance: 95.5, performance: 100, punctuality: 90 },
  { id: '2030005', name: 'MD. SAIFUL ISLAM', department: 'MEDICINE', attendance: 81.8, performance: 45, punctuality: 65 },
  { id: '2030008', name: 'NURSES FATIMA BEGUM', department: 'NURSING', attendance: 100, performance: 95, punctuality: 98 },
  { id: '2030012', name: 'DR. AHMED HASSAN', department: 'EMERGENCY', attendance: 88, performance: 85, punctuality: 82 }
];

export const mockWeeklyAttendance = [
  { day: 'Monday', present: 89, late: 15, absent: 11 },
  { day: 'Tuesday', present: 95, late: 10, absent: 8 },
  { day: 'Wednesday', present: 92, late: 12, absent: 9 },
  { day: 'Thursday', present: 90, late: 18, absent: 14 },
  { day: 'Friday', present: 85, late: 20, absent: 18 },
  { day: 'Saturday', present: 78, late: 22, absent: 25 }
];