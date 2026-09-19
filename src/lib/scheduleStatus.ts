import type { Project, Milestone } from '../context/BlockchainContext';

const toStartOfDay = (dateString?: string | null) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

export const isPastDate = (dateString?: string | null) => {
  const date = toStartOfDay(dateString);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date < today;
};

export const isMilestoneDelayed = (milestone: Pick<Milestone, 'dueDate' | 'status'>) => {
  return isPastDate(milestone.dueDate) && !['Verified', 'Paid'].includes(milestone.status);
};

export const isProjectDelayed = (project: Pick<Project, 'status' | 'endDate' | 'milestones'>) => {
  if (project.status === 'Completed') return false;

  return isPastDate(project.endDate) || project.milestones.some(isMilestoneDelayed);
};
