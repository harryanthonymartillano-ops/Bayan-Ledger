import React, { useState } from 'react';
import { Milestone, MilestonePhoto } from '../context/BlockchainContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { MapPin, Camera, Clock, CheckCircle, ChevronRight } from 'lucide-react';

interface MilestoneProofGalleryProps {
  milestones: Milestone[];
}

export const MilestoneProofGallery: React.FC<MilestoneProofGalleryProps> = ({ milestones }) => {
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState(false);

  const getMilestoneWithPhotos = milestones.filter(m => m.photos && m.photos.length > 0);
  const expanded = selectedMilestone;
  const current = milestones.find(m => m.id === expanded);

  const beforePhotos = current?.photos?.filter(p => p.type === 'before') || [];
  const afterPhotos = current?.photos?.filter(p => p.type === 'after') || [];
  const proofPhotos = current?.photos?.filter(p => p.type === 'proof') || [];

  const getPhotoTypeColor = (type: string) => {
    switch (type) {
      case 'before':
        return 'bg-amber-100 text-amber-800';
      case 'after':
        return 'bg-green-100 text-green-800';
      case 'proof':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getPhotoTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Milestone Proof Gallery</h3>

        {getMilestoneWithPhotos.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <Camera className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-500 font-medium">No milestone photos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {getMilestoneWithPhotos.map((milestone) => (
              <div
                key={milestone.id}
                className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedMilestone(milestone.id)}
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-b border-slate-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{milestone.title}</h4>
                      <p className="text-sm text-slate-600 mt-1">{milestone.percentage}% Complete</p>
                    </div>
                    <Badge className={milestone.status === 'Verified' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                      {milestone.status}
                    </Badge>
                  </div>
                </div>

                {/* Photo Grid */}
                <div className="p-4">
                  {milestone.photos && milestone.photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {milestone.photos.slice(0, 3).map((photo) => (
                        <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-200">
                          <img
                            src={photo.url}
                            alt={photo.type}
                            className="w-full h-full object-cover"
                          />
                          <Badge className={`absolute bottom-1 right-1 text-xs ${getPhotoTypeColor(photo.type)}`}>
                            {getPhotoTypeLabel(photo.type)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Verification Info */}
                  <div className="space-y-2 text-sm">
                    {milestone.verifiedBy && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Verified by {milestone.verifiedBy}</span>
                      </div>
                    )}
                    {milestone.dateVerified && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(milestone.dateVerified).toLocaleDateString()}</span>
                      </div>
                    )}
                    {milestone.geoTag && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="h-4 w-4" />
                        <span>{milestone.geoTag.lat.toFixed(4)}°, {milestone.geoTag.lng.toFixed(4)}°</span>
                      </div>
                    )}
                  </div>

                  {/* View More Button */}
                  <Button
                    size="sm"
                    className="w-full mt-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMilestone(milestone.id);
                    }}
                  >
                    View Details <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed View */}
      {expanded && current && (
        <div className="border-2 border-blue-200 rounded-lg p-6 bg-blue-50">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-semibold text-slate-900">{current.title}</h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedMilestone(null)}
            >
              Close
            </Button>
          </div>

          {/* Toggle Comparison */}
          {beforePhotos.length > 0 && afterPhotos.length > 0 && (
            <div className="flex gap-2 mb-6">
              <Button
                size="sm"
                onClick={() => setComparisonMode(false)}
                className={comparisonMode ? '' : 'bg-blue-600'}
              >
                Gallery View
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setComparisonMode(true)}
              >
                Before/After
              </Button>
            </div>
          )}

          {/* Photo Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Before Photos */}
            {beforePhotos.length > 0 && (
              <div>
                <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-800">Before</Badge>
                </h5>
                <div className="space-y-3">
                  {beforePhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                    >
                      <img src={photo.url} alt="Before" className="w-full h-64 object-cover" />
                      <div className="p-3">
                        <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                          <Clock className="h-3 w-3" />
                          {new Date(photo.timestamp).toLocaleString()}
                        </div>
                        {photo.geoTag && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <MapPin className="h-3 w-3" />
                            {photo.geoTag.lat.toFixed(4)}°, {photo.geoTag.lng.toFixed(4)}°
                          </div>
                        )}
                        {photo.description && (
                          <p className="text-xs text-slate-700 mt-2">{photo.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* After Photos */}
            {afterPhotos.length > 0 && (
              <div>
                <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">After</Badge>
                </h5>
                <div className="space-y-3">
                  {afterPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                    >
                      <img src={photo.url} alt="After" className="w-full h-64 object-cover" />
                      <div className="p-3">
                        <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                          <Clock className="h-3 w-3" />
                          {new Date(photo.timestamp).toLocaleString()}
                        </div>
                        {photo.geoTag && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <MapPin className="h-3 w-3" />
                            {photo.geoTag.lat.toFixed(4)}°, {photo.geoTag.lng.toFixed(4)}°
                          </div>
                        )}
                        {photo.description && (
                          <p className="text-xs text-slate-700 mt-2">{photo.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Proof Photos */}
          {proofPhotos.length > 0 && (
            <div>
              <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800">Proof of Completion</Badge>
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {proofPhotos.map((photo) => (
                  <div key={photo.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <img src={photo.url} alt="Proof" className="w-full h-48 object-cover" />
                    <div className="p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                        <Clock className="h-3 w-3" />
                        {new Date(photo.timestamp).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        Verified by {photo.uploadedBy}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
