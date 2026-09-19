/**
 * Budget Source Categories
 * Municipal Project Funding Sources for Municipality of Santa Cruz, Laguna
 */

export const LGU_SUB_FUNDS = [
  'General Fund',
  '20% Development Fund',
  '5% DRRM Fund',
  '5% GAD Fund',
  '1% SC/PWD Fund',
  '1% LCPC Fund',
] as const;

export type LguSubFund = (typeof LGU_SUB_FUNDS)[number];

export const BUDGET_SOURCES = [
  // Local Government Fund (LGU Santa Cruz)
  {
    category: 'Local Government Fund (LGU)',
    sources: [
      'Local Government Unit (LGU)',
      'Special Education Fund (SEF)',
      'Provincial Government Assistance',
      'Barangay Funds',
    ],
  },
  // National Government Transfers & Subsidies
  {
    category: 'National Government Transfers',
    sources: [
      'National Tax Allotment (NTA)',
      'Local Government Support Fund (LGSF - DBM)',
      'National Government Agency Subsidy (DPWH / DILG / DA)',
      'GAA (General Appropriations Act)',
    ],
  },
  // Special & Other Sources
  {
    category: 'Special & Other Sources',
    sources: [
      'PPP (Public-Private Partnership)',
      'Community / Civic Donations',
      'Other',
    ],
  },
] as const;

// Flatten for easier lookup and form options
export const FLAT_BUDGET_SOURCES = BUDGET_SOURCES.flatMap((category) =>
  category.sources.map((source) => ({
    source,
    category: category.category,
  }))
);

// Export just the source names for dropdown
export const BUDGET_SOURCE_OPTIONS = FLAT_BUDGET_SOURCES.map((item) => item.source);

// Type for budget source
export type BudgetSource = (typeof FLAT_BUDGET_SOURCES)[number]['source'];

export const isValidBudgetSource = (source: string): source is BudgetSource => {
  return BUDGET_SOURCE_OPTIONS.includes(source as BudgetSource);
};
