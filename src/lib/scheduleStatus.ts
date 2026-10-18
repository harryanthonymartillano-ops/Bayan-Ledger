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

export const isMilestoneDelayed = (milestone: any) => {
  if (!milestone) return false;
  const dueDate = milestone.dueDate || milestone.due_date;
  return isPastDate(dueDate) && !['Verified', 'Paid'].includes(milestone.status);
};

export const isProjectDelayed = (project: any) => {
  if (!project || project.status === 'Completed') return false;

  const endDate = project.endDate || project.end_date;
  const milestones = Array.isArray(project.milestones) ? project.milestones : [];
  return isPastDate(endDate) || milestones.some(isMilestoneDelayed);
};
