/**
 * Budget Source Categories (Backend Constants)
 * Used for validation and categorization of budget sources
 */

export const BUDGET_SOURCES = [
  // National & Government Sources
  'GAA (General Appropriations Act)',
  'CHED (Commission on Higher Education)',
  'DBM (Department of Budget and Management)',
  'National Government Agencies',
  'Internal Revenue Allotment (IRA)',
  'PAGC (Presidential Assistance & Contingency)',
  // Local Government
  'Local Government Unit (LGU)',
  'Municipal/City Internal Revenue',
  'Provincial Government',
  'Barangay Funds',
  // Financing & Lending
  'Bank Loan (Commercial)',
  'Development Bank (DBP/LBP)',
  'Municipal Bonds',
  'Development Bonds',
  'Government Loan (National)',
  // Private & Partnership
  'Private Sector/Corporate',
  'PPP (Public-Private Partnership)',
  'CSR (Corporate Social Responsibility)',
  'Private Foundation',
  'Business Consortium',
  // International & Donor
  'International Donor (Bilateral Aid)',
  'ODA (Official Development Assistance)',
  'World Bank',
  'Asian Development Bank (ADB)',
  'UN Agencies (UNDP, UNICEF, etc.)',
  'International NGO',
  'Foreign Government',
  // Other Sources
  'Insurance/Bond Proceeds',
  'Special Funds/Endowments',
  'Employee Contributions',
  'Community/Public Donations',
  'Mixed Sources',
  'Other',
] as const;

export type BudgetSource = (typeof BUDGET_SOURCES)[number];

export const isValidBudgetSource = (source: string): source is BudgetSource => {
  if (!source || typeof source !== 'string') return false;
  const trimmed = source.trim();
  // Accept any non-empty string as a valid budget source (predefined or custom)
  return trimmed.length > 0;
};
