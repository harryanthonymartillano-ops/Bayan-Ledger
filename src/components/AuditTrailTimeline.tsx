import React from 'react';
import { ApprovalStage } from '../context/BlockchainContext';
import { Badge } from './ui/badge';

interface AuditTrailTimelineProps {
  approvals: ApprovalStage[];
}

export const AuditTrailTimeline: React.FC<AuditTrailTimelineProps> = ({ approvals }) => {
  const getStatusBadge = (status: ApprovalStage['status']) => {
    switch (status) {
      case 'Verified':
        return (
          <Badge className="bg-green-100 text-green-800 border border-green-300">
            ✓ Verified
          </Badge>
        );
      case 'Pending':
        return (
          <Badge className="bg-amber-100 text-amber-800 border border-amber-300">
            ◊ Pending
          </Badge>
        );
      case 'Rejected':
        return (
          <Badge className="bg-red-100 text-red-800 border border-red-300">
            ✗ Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatSignature = (signature: string) => {
    if (!signature) return 'N/A';
    return `${signature.substring(0, 10)}...${signature.substring(signature.length - 8)}`;
  };

  return (
    <div className="space-y-6">
      {/* Timeline header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900">Approval Timeline</h3>
        <p className="text-sm text-blue-700 mt-1">Immutable record of all approvals and blockchain signatures</p>
      </div>

      {/* Timeline blocks */}
      <div className="relative pl-8">
        {/* Vertical line */}
        {approvals.length > 1 && (
          <div className="absolute left-[6px] top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-600" />
        )}

        {approvals.map((approval, index) => (
          <div key={approval.id} className="relative mb-8 pb-8">
            {/* Timeline dot */}
            <div className="absolute left-[-28px] top-2 w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 border-4 border-white shadow-lg" />

            {/* Approval card (block design) */}
            <div className="bg-white border-2 border-slate-200 rounded-lg p-5 shadow-md hover:shadow-lg transition-shadow">
              {/* Header with stage and status */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{approval.stage}</h4>
                  <p className="text-xs text-slate-500 mt-1">Stage {index + 1} of {approvals.length}</p>
                </div>
                <div>{getStatusBadge(approval.status)}</div>
              </div>

              {/* Content grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Approved By</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{approval.approvedBy}</p>
                  <p className="text-xs text-slate-500">{approval.approvedByRole}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Timestamp</p>
                  <p className="text-sm text-slate-900 mt-1 font-mono">{formatTimestamp(approval.timestamp)}</p>
                </div>
              </div>

              {/* Digital signature */}
              <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Digital Signature</p>
                <p className="text-xs font-mono text-slate-700 mt-1 break-all">{formatSignature(approval.signature)}</p>
                <p className="text-[10px] text-slate-500 mt-1">Full Hash: {approval.signature}</p>
              </div>

              {/* Comments */}
              {approval.comments && (
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Comments</p>
                  <p className="text-sm text-slate-700 mt-2 italic">{approval.comments}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Timeline end marker */}
        {approvals.length > 0 && (
          <div className="absolute left-[-28px] top-auto -bottom-4 w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 border-4 border-white shadow-lg" />
        )}
      </div>

      {/* Empty state */}
      {approvals.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <p className="text-slate-500 font-medium">No approvals recorded yet</p>
          <p className="text-xs text-slate-400 mt-1">Approvals will appear here as the project progresses through stages</p>
        </div>
      )}
    </div>
  );
};
