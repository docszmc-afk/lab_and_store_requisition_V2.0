
import React from 'react';
import { RequisitionStatus, UrgencyLevel, WorkflowStage } from '../types';

export const StatusBadge: React.FC<{ status: RequisitionStatus }> = ({ status }) => {
  let colorClass = '';

  switch (status) {
    case RequisitionStatus.APPROVED:
      colorClass = 'bg-green-100 text-green-800 border-green-200';
      break;
    case RequisitionStatus.PENDING:
      colorClass = 'bg-amber-100 text-amber-800 border-amber-200';
      break;
    case RequisitionStatus.IN_REVIEW:
      colorClass = 'bg-blue-50 text-blue-800 border-blue-100';
      break;
    case RequisitionStatus.RETURNED:
      colorClass = 'bg-rose-100 text-rose-800 border-rose-200';
      break;
    case RequisitionStatus.REJECTED:
      colorClass = 'bg-red-100 text-red-800 border-red-200';
      break;
    case RequisitionStatus.FULFILLED:
      colorClass = 'bg-blue-100 text-blue-800 border-blue-200';
      break;
    default:
      colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {status}
    </span>
  );
};

export const StageBadge: React.FC<{ stage?: WorkflowStage }> = ({ stage }) => {
  if (!stage) return null;

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-zankli-orange"></span>
      {stage}
    </span>
  );
};

export const UrgencyBadge: React.FC<{ level: UrgencyLevel }> = ({ level }) => {
  let colorClass = '';

  switch (level) {
    case UrgencyLevel.CRITICAL:
      colorClass = 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20';
      break;
    case UrgencyLevel.HIGH:
      colorClass = 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20';
      break;
    case UrgencyLevel.NORMAL:
      colorClass = 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10';
      break;
    case UrgencyLevel.LOW:
      colorClass = 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/10';
      break;
  }

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${colorClass}`}>
      {level}
    </span>
  );
};
