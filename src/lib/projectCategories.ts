export const PROJECT_CATEGORIES = [
  'Infrastructure',
  'Transport & Mobility',
  'Water & Sanitation',
  'Flood Control & Drainage',
  'Health',
  'Education',
  'Social Services',
  'Agriculture & Fisheries',
  'Environment & Solid Waste',
  'Disaster Risk Reduction & Resilience',
  'Livelihood & Employment',
  'Public Safety & Emergency Response',
  'Housing & Urban Development',
  'Digital Governance',
  'Tourism',
  'Culture & Heritage',
  'Sports & Youth Development',
  'Gender & Development',
  'Senior Citizens & PWD Support',
  'Peace & Order',
  'Economic Development',
  'Energy',
  'Other',
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PUBLIC_PROJECT_CATEGORIES = ['All', ...PROJECT_CATEGORIES] as const;
