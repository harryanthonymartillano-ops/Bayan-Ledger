import React, { useState } from 'react';
import { Document } from '../context/BlockchainContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Copy, Download, CheckCircle, Lock, FileText, Clock } from 'lucide-react';
import { MediaLightbox } from './MediaLightbox';

interface DocumentManagementProps {
  documents: Document[];
  projectId: string;
}

export const DocumentManagement: React.FC<DocumentManagementProps> = ({ documents, projectId }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState<number | null>(null);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopied(hash);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatHash = (hash: string) => {
    return `${hash.substring(0, 16)}...${hash.substring(hash.length - 8)}`;
  };

  const getDocTypeColor = (type: string) => {
    switch (type) {
      case 'Procurement':
        return 'bg-blue-100 text-blue-800';
      case 'Contract':
        return 'bg-purple-100 text-purple-800';
      case 'Personnel':
        return 'bg-green-100 text-green-800';
      case 'Report':
        return 'bg-orange-100 text-orange-800';
      case 'Invoice':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Document Management</h3>
        <Badge className="bg-blue-100 text-blue-800">{documents.length} Documents</Badge>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <FileText className="h-10 w-10 text-slate-400 mx-auto mb-2" />
          <p className="text-slate-500 font-medium">No documents uploaded</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <h4 className="font-semibold text-slate-900">{doc.title}</h4>
                  </div>
                  <Badge className={getDocTypeColor(doc.type)}>{doc.type}</Badge>
                </div>
                <div className="text-right">
                  {doc.verified ? (
                    <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800">Pending Verify</Badge>
                  )}
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                <div>
                  <p className="text-slate-500">Uploaded By</p>
                  <p className="font-medium text-slate-900">{doc.uploadedBy}</p>
                </div>
                <div>
                  <p className="text-slate-500">Date</p>
                  <p className="font-medium text-slate-900">{new Date(doc.dateUploaded).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-slate-500">Size</p>
                  <p className="font-medium text-slate-900">{(doc.size / 1024).toFixed(2)} KB</p>
                </div>
                <div>
                  <p className="text-slate-500">Version</p>
                  <p className="font-medium text-slate-900">v{doc.version}</p>
                </div>
              </div>

              {/* IPFS Hash */}
              <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4 text-slate-500" />
                  <p className="text-xs font-semibold text-slate-600 uppercase">IPFS Hash (SHA-256)</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-slate-700 bg-white p-2 rounded border border-slate-200 break-all">
                    {doc.ipfsHash}
                  </code>
                  <button
                    onClick={() => copyHash(doc.ipfsHash)}
                    className="p-2 hover:bg-slate-200 rounded transition-colors"
                  >
                    {copied === doc.ipfsHash ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-slate-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Checksum Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Lock className="h-3 w-3" />
                  <span className="font-mono">{formatHash(doc.checksumHash)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => setSelectedDocumentIndex(documents.findIndex((item) => item.id === doc.id))}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              </div>

              {/* Verification Info */}
              {doc.verified && doc.verifiedBy && (
                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
                  <p>✓ Verified by {doc.verifiedBy} on {doc.verifiedDate ? new Date(doc.verifiedDate).toLocaleDateString() : 'N/A'}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Immutability Info */}
      <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-green-900 mb-1">Immutability Proof</p>
            <p className="text-xs text-green-800">
              All documents are cryptographically hashed using SHA-256 and stored immutably on the blockchain. Any modification to the document will result in a different hash, making tampering immediately detectable.
            </p>
          </div>
        </div>
      </div>

      {selectedDocumentIndex !== null && documents[selectedDocumentIndex] && (
        <MediaLightbox
          items={documents.map((doc) => ({
            type: doc.fileFormat === 'JPEG' || doc.fileFormat === 'PNG' ? 'image' : 'document',
            url: doc.url,
            title: doc.title,
            fileFormat: doc.fileFormat,
          }))}
          index={selectedDocumentIndex}
          onClose={() => setSelectedDocumentIndex(null)}
          onIndexChange={setSelectedDocumentIndex}
        />
      )}
    </div>
  );
};
