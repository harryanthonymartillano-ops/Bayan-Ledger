import React from 'react';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { Badge } from './ui/badge';

interface MilestoneVerificationChecklistProps {
  isReady: boolean;
  photoCount: number;
  reportCount: number;
  missingPhotos: number;
  missingReports: number;
}

export const MilestoneVerificationChecklist: React.FC<MilestoneVerificationChecklistProps> = ({
  isReady,
  photoCount,
  reportCount,
  missingPhotos,
  missingReports
}) => {
  return (
    <div className={`border-2 rounded-lg p-4 ${isReady ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
      <div className="flex items-center gap-2 mb-4">
        {isReady ? (
          <>
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-green-900">Ready for Verification</h3>
          </>
        ) : (
          <>
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-amber-900">Missing Requirements</h3>
          </>
        )}
      </div>

      <div className="space-y-3">
        {/* Photos Requirement */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {photoCount >= 1 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-slate-300" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className={`text-sm font-medium ${photoCount >= 1 ? 'text-green-900' : 'text-amber-900'}`}>
                Minimum 1 Photo Required
              </p>
              <Badge className={photoCount >= 1 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                {photoCount}/1
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {photoCount >= 1
                ? '✓ Photo uploaded'
                : `Need ${missingPhotos} more photo(s)`}
            </p>
          </div>
        </div>

        {/* Report Requirement */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {reportCount >= 1 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-slate-300" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className={`text-sm font-medium ${reportCount >= 1 ? 'text-green-900' : 'text-amber-900'}`}>
                Minimum 1 Report Required
              </p>
              <Badge className={reportCount >= 1 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                {reportCount}/1
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {reportCount >= 1
                ? '✓ Report document uploaded'
                : `Need ${missingReports} report document(s) (PDF/Progress Report)`}
            </p>
          </div>
        </div>
      </div>

      {/* Status Footer */}
      {isReady && (
        <div className="mt-4 p-2 bg-green-100 border border-green-300 rounded text-xs text-green-800">
          ✓ All requirements met. Milestone is ready for verification and payment approval.
        </div>
      )}

      {!isReady && (
        <div className="mt-4 p-2 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800">
          ⚠ Please upload missing {missingPhotos > 0 ? `${missingPhotos} photo(s)` : ''}{missingPhotos > 0 && missingReports > 0 ? ' and ' : ''}{missingReports > 0 ? `${missingReports} report(s)` : ''} before verifying this milestone.
        </div>
      )}
    </div>
  );
};
