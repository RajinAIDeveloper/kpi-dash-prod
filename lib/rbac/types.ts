// lib/rbac/types.ts
// Enhanced Role-Based Access Control Type Definitions

// Dashboard-Focused Permission System
export interface Dashboard {
  id: string
  name: string
  description: string
  route: string
  category: 'clinical' | 'financial' | 'operational' | 'admin'
}

export interface ComponentPermission {
  id: string
  name: string
  description: string
  dashboardId: string
  componentType: 'kpi' | 'chart' | 'card' | 'section'
  componentId: string
  apiEndpoint?: string
  level: 'read' | 'write' | 'admin'
}

export interface Permission {
  id: string
  name: string
  description: string
  type: 'dashboard' | 'component' | 'system'
  resourceId: string // Dashboard ID, Component ID, or System feature ID
  level: 'read' | 'write' | 'admin'
  category: 'clinical' | 'financial' | 'operational' | 'admin' | 'settings'
}

export interface RolePermission {
  id: string
  name: string
  description: string
  permissions: string[] // Array of permission IDs
  category: string
  isSystemDefault: boolean
}

export interface Role {
  id: string
  name: string
  description: string
  rolePermissions: string[] // Array of role permission IDs
  isSystemDefault: boolean
  isActive: boolean // Whether the role is available for assignment
  createdAt: string
  updatedAt: string
}

export interface UserRoleAssignment {
  userId: string // Clerk user ID
  roleIds: string[] // Array of role IDs
  assignedAt: string
  assignedBy: string
}

export interface UserDefaults {
  userId: string
  dashboardDefaults: Record<string, any> // Default filters per dashboard
  kpiDefaults: Record<string, any> // Default KPI settings
  chartDefaults: Record<string, any> // Default chart configurations
  globalDefaults: {
    startDate?: string
    endDate?: string
    patientCategory?: string
    medicineCategory?: string
    serviceType?: string
    department?: string
  }
  lastUpdated: string
}

export interface RBACState {
  // Core RBAC
  dashboards: Dashboard[]
  permissions: Permission[]
  rolePermissions: RolePermission[]
  roles: Role[]
  userAssignments: UserRoleAssignment[]
  userDefaults: UserDefaults[]
  currentUserPermissions: string[] // Calculated permissions for current user

  // Dashboard visibility cache
  dashboardVisibility: Record<string, boolean> // userId -> dashboardId visibility
  componentVisibility: Record<string, Record<string, boolean>> // userId -> componentId visibility
}

// Dashboard Definitions
export const DASHBOARDS: Dashboard[] = [
  {
    id: 'main-dashboard',
    name: 'Main Dashboard',
    description: 'Overview of all hospital operations and KPIs',
    route: '/dashboard',
    category: 'operational'
  },
  {
    id: 'opd-service',
    name: 'OPD Service',
    description: 'Outpatient Department analytics and management',
    route: '/opd-service',
    category: 'clinical'
  },
  {
    id: 'ipd-service',
    name: 'IPD Service',
    description: 'Inpatient Department analytics and bed management',
    route: '/ipd-service',
    category: 'clinical'
  },
  {
    id: 'pharmacy-service',
    name: 'Pharmacy Service',
    description: 'Pharmacy operations and medicine analytics',
    route: '/pharmacy-service',
    category: 'operational'
  },
  {
    id: 'admin-service',
    name: 'Admin Service',
    description: 'Administrative functions and HR analytics',
    route: '/admin-service',
    category: 'admin'
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'System configuration and RBAC management',
    route: '/settings',
    category: 'admin'
  }
]

// Dashboard-Focused Permission Mapping
export const DASHBOARD_PERMISSIONS: Permission[] = [
  // Dashboard Access Permissions
  {
    id: 'dashboard_main_read',
    name: 'Main Dashboard Access',
    description: 'View main dashboard overview',
    type: 'dashboard',
    resourceId: 'main-dashboard',
    level: 'read',
    category: 'operational'
  },
  {
    id: 'dashboard_opd_read',
    name: 'OPD Service Access',
    description: 'View OPD service dashboard',
    type: 'dashboard',
    resourceId: 'opd-service',
    level: 'read',
    category: 'clinical'
  },
  {
    id: 'dashboard_ipd_read',
    name: 'IPD Service Access',
    description: 'View IPD service dashboard',
    type: 'dashboard',
    resourceId: 'ipd-service',
    level: 'read',
    category: 'clinical'
  },
  {
    id: 'dashboard_pharmacy_read',
    name: 'Pharmacy Service Access',
    description: 'View pharmacy service dashboard',
    type: 'dashboard',
    resourceId: 'pharmacy-service',
    level: 'read',
    category: 'operational'
  },
  {
    id: 'dashboard_admin_read',
    name: 'Admin Service Access',
    description: 'View admin service dashboard',
    type: 'dashboard',
    resourceId: 'admin-service',
    level: 'read',
    category: 'admin'
  },

  // KPI Component Permissions
  {
    id: 'kpi_patient_total_read',
    name: 'Total Patients KPI',
    description: 'View total patients processed KPI',
    type: 'component',
    resourceId: 'total-patients',
    level: 'read',
    category: 'clinical'
  },
  {
    id: 'kpi_patient_revisit_read',
    name: 'Patient Revisit KPI',
    description: 'View patient revisit rate KPI',
    type: 'component',
    resourceId: 'patient-revisit',
    level: 'read',
    category: 'clinical'
  },
  {
    id: 'kpi_payroll_expense_read',
    name: 'Payroll Expense KPI',
    description: 'View total payroll expense KPI',
    type: 'component',
    resourceId: 'payroll-expense',
    level: 'read',
    category: 'financial'
  },
  {
    id: 'kpi_patient_demographics_read',
    name: 'Patient Demographics KPI',
    description: 'View patient location demographics KPI',
    type: 'component',
    resourceId: 'patient-demographics',
    level: 'read',
    category: 'clinical'
  },
  {
    id: 'kpi_patient_spending_read',
    name: 'Patient Spending KPI',
    description: 'View patient spending patterns KPI',
    type: 'component',
    resourceId: 'patient-spending',
    level: 'read',
    category: 'financial'
  },
  {
    id: 'kpi_consultant_revenue_read',
    name: 'Consultant Revenue KPI',
    description: 'View revenue by consultant KPI',
    type: 'component',
    resourceId: 'consultant-revenue',
    level: 'read',
    category: 'financial'
  },
  {
    id: 'kpi_insurance_coverage_read',
    name: 'Insurance Coverage KPI',
    description: 'View insurance coverage tracking KPI',
    type: 'component',
    resourceId: 'insurance-coverage',
    level: 'read',
    category: 'financial'
  },
  {
    id: 'kpi_bed_occupancy_read',
    name: 'Bed Occupancy KPI',
    description: 'View bed availability and occupancy KPI',
    type: 'component',
    resourceId: 'bed-occupancy',
    level: 'read',
    category: 'operational'
  },
  {
    id: 'kpi_employee_performance_read',
    name: 'Employee Performance KPI',
    description: 'View employee attendance and performance KPI',
    type: 'component',
    resourceId: 'employee-performance',
    level: 'read',
    category: 'admin'
  },
  {
    id: 'kpi_medicine_waste_read',
    name: 'Medicine Waste KPI',
    description: 'View medicine waste and expiry KPI',
    type: 'component',
    resourceId: 'medicine-waste',
    level: 'read',
    category: 'operational'
  },
  {
    id: 'kpi_employee_salary_read',
    name: 'Employee Salary KPI',
    description: 'View employee salary summaries KPI',
    type: 'component',
    resourceId: 'employee-salary',
    level: 'read',
    category: 'admin'
  },

  // Chart Component Permissions
  {
    id: 'chart_patient_revisit_read',
    name: 'Patient Revisit Chart',
    description: 'View patient revisit analysis chart',
    type: 'component',
    resourceId: 'chart-patient-revisit',
    level: 'read',
    category: 'clinical'
  },
  {
    id: 'chart_demographics_pie_read',
    name: 'Demographics Pie Chart',
    description: 'View patient demographics pie chart',
    type: 'component',
    resourceId: 'chart-demographics-pie',
    level: 'read',
    category: 'clinical'
  },
  {
    id: 'chart_spending_analysis_read',
    name: 'Spending Analysis Chart',
    description: 'View patient spending analysis chart',
    type: 'component',
    resourceId: 'chart-spending-analysis',
    level: 'read',
    category: 'financial'
  },
  {
    id: 'chart_consultant_revenue_read',
    name: 'Consultant Revenue Chart',
    description: 'View revenue by consultant chart',
    type: 'component',
    resourceId: 'chart-consultant-revenue',
    level: 'read',
    category: 'financial'
  },
  {
    id: 'chart_bed_occupancy_read',
    name: 'Bed Occupancy Chart',
    description: 'View bed occupancy monitoring chart',
    type: 'component',
    resourceId: 'chart-bed-occupancy',
    level: 'read',
    category: 'operational'
  },
  {
    id: 'chart_medicine_waste_read',
    name: 'Medicine Waste Chart',
    description: 'View medicine waste analysis chart',
    type: 'component',
    resourceId: 'chart-medicine-waste',
    level: 'read',
    category: 'operational'
  },
  {
    id: 'chart_payroll_comparison_read',
    name: 'Payroll Comparison Chart',
    description: 'View department salary comparison chart',
    type: 'component',
    resourceId: 'chart-payroll-comparison',
    level: 'read',
    category: 'financial'
  },

  // System Permissions
  {
    id: 'settings_read',
    name: 'Settings Access',
    description: 'View application settings',
    type: 'system',
    resourceId: 'settings',
    level: 'read',
    category: 'settings'
  },
  {
    id: 'settings_write',
    name: 'Settings Management',
    description: 'Modify application settings and defaults',
    type: 'system',
    resourceId: 'settings',
    level: 'write',
    category: 'settings'
  },
  {
    id: 'rbac_admin',
    name: 'RBAC Administration',
    description: 'Manage roles, permissions, and user assignments',
    type: 'system',
    resourceId: 'rbac',
    level: 'admin',
    category: 'admin'
  },
  {
    id: 'user_defaults_read',
    name: 'User Defaults Access',
    description: 'View user-specific default configurations',
    type: 'system',
    resourceId: 'user-defaults',
    level: 'read',
    category: 'settings'
  },
  {
    id: 'user_defaults_write',
    name: 'User Defaults Management',
    description: 'Modify user-specific default configurations',
    type: 'system',
    resourceId: 'user-defaults',
    level: 'write',
    category: 'settings'
  }
]

// Enhanced Role Permissions
export const DEFAULT_ROLE_PERMISSIONS: RolePermission[] = [
  {
    id: 'dashboard_viewer',
    name: 'Dashboard Viewer',
    description: 'Basic dashboard viewing access - clinical dashboards only',
    permissions: [
      'dashboard_main_read',
      'dashboard_opd_read',
      'dashboard_ipd_read',
      'kpi_patient_total_read',
      'kpi_patient_revisit_read',
      'kpi_patient_demographics_read',
      'chart_patient_revisit_read',
      'chart_demographics_pie_read'
    ],
    category: 'clinical',
    isSystemDefault: true
  },
  {
    id: 'clinical_analyst',
    name: 'Clinical Data Analyst',
    description: 'Full access to clinical dashboards and components',
    permissions: [
      'dashboard_main_read',
      'dashboard_opd_read',
      'dashboard_ipd_read',
      'kpi_patient_total_read',
      'kpi_patient_revisit_read',
      'kpi_patient_demographics_read',
      'kpi_bed_occupancy_read',
      'chart_patient_revisit_read',
      'chart_demographics_pie_read',
      'chart_bed_occupancy_read'
    ],
    category: 'clinical',
    isSystemDefault: true
  },
  {
    id: 'financial_analyst',
    name: 'Financial Data Analyst',
    description: 'Access to financial dashboards and revenue data',
    permissions: [
      'dashboard_main_read',
      'kpi_payroll_expense_read',
      'kpi_patient_spending_read',
      'kpi_consultant_revenue_read',
      'kpi_insurance_coverage_read',
      'chart_spending_analysis_read',
      'chart_consultant_revenue_read',
      'chart_payroll_comparison_read'
    ],
    category: 'financial',
    isSystemDefault: true
  },
  {
    id: 'pharmacy_manager',
    name: 'Pharmacy Manager',
    description: 'Access to pharmacy operations and medicine analytics',
    permissions: [
      'dashboard_main_read',
      'dashboard_pharmacy_read',
      'kpi_medicine_waste_read',
      'chart_medicine_waste_read'
    ],
    category: 'operational',
    isSystemDefault: true
  },
  {
    id: 'department_manager',
    name: 'Department Manager',
    description: 'Access to relevant departmental data and basic settings',
    permissions: [
      'dashboard_main_read',
      'dashboard_opd_read',
      'dashboard_ipd_read',
      'dashboard_pharmacy_read',
      'kpi_patient_total_read',
      'kpi_patient_revisit_read',
      'kpi_bed_occupancy_read',
      'kpi_medicine_waste_read',
      'chart_patient_revisit_read',
      'chart_bed_occupancy_read',
      'chart_medicine_waste_read',
      'settings_read',
      'user_defaults_read',
      'user_defaults_write'
    ],
    category: 'operational',
    isSystemDefault: true
  },
  {
    id: 'hr_administrator',
    name: 'HR Administrator',
    description: 'Access to employee and payroll data management',
    permissions: [
      'dashboard_main_read',
      'dashboard_admin_read',
      'kpi_payroll_expense_read',
      'kpi_employee_performance_read',
      'kpi_employee_salary_read',
      'chart_payroll_comparison_read',
      'settings_read',
      'user_defaults_read'
    ],
    category: 'admin',
    isSystemDefault: true
  },
  {
    id: 'system_administrator',
    name: 'System Administrator',
    description: 'Full system access including RBAC management',
    permissions: [
      // All dashboard access
      'dashboard_main_read',
      'dashboard_opd_read',
      'dashboard_ipd_read',
      'dashboard_pharmacy_read',
      'dashboard_admin_read',
      // All KPI access
      'kpi_patient_total_read',
      'kpi_patient_revisit_read',
      'kpi_payroll_expense_read',
      'kpi_patient_demographics_read',
      'kpi_patient_spending_read',
      'kpi_consultant_revenue_read',
      'kpi_insurance_coverage_read',
      'kpi_bed_occupancy_read',
      'kpi_employee_performance_read',
      'kpi_medicine_waste_read',
      'kpi_employee_salary_read',
      // All chart access
      'chart_patient_revisit_read',
      'chart_demographics_pie_read',
      'chart_spending_analysis_read',
      'chart_consultant_revenue_read',
      'chart_bed_occupancy_read',
      'chart_medicine_waste_read',
      'chart_payroll_comparison_read',
      // System administration
      'settings_read',
      'settings_write',
      'rbac_admin',
      'user_defaults_read',
      'user_defaults_write'
    ],
    category: 'admin',
    isSystemDefault: true
  }
]

// Enhanced Default Roles
export const DEFAULT_ROLES: Role[] = [
  {
    id: 'clinical_viewer',
    name: 'Clinical Viewer',
    description: 'Basic clinical dashboard viewing access only',
    rolePermissions: ['dashboard_viewer'],
    isSystemDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'clinical_analyst',
    name: 'Clinical Analyst',
    description: 'Full access to clinical data and analytics',
    rolePermissions: ['clinical_analyst'],
    isSystemDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'financial_analyst',
    name: 'Financial Analyst',
    description: 'Access to financial dashboards and revenue analytics',
    rolePermissions: ['financial_analyst'],
    isSystemDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pharmacy_manager',
    name: 'Pharmacy Manager',
    description: 'Pharmacy operations and medicine waste management',
    rolePermissions: ['pharmacy_manager'],
    isSystemDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'department_manager',
    name: 'Department Manager',
    description: 'Multi-departmental access with user settings management',
    rolePermissions: ['department_manager'],
    isSystemDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'hr_administrator',
    name: 'HR Administrator',
    description: 'Human resources and employee data management',
    rolePermissions: ['hr_administrator'],
    isSystemDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'system_administrator',
    name: 'System Administrator',
    description: 'Full system access including RBAC and user management',
    rolePermissions: ['system_administrator'],
    isSystemDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]