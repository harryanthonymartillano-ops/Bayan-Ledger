import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBlockchain } from '../../context/BlockchainContext';
import { TransactionReceipt } from '../../components/TransactionReceipt';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Copy, CheckCircle, ExternalLink, ArrowLeft } from 'lucide-react';

export const TransactionDetails: React.FC = () => {
  const { txId } = useParams();
  const navigate = useNavigate();
  const { projects } = useBlockchain();
  const [copied, setCopied] = useState(false);

  // Find the transaction
  let transaction = null;
  let project = null;

  for (const p of projects) {
    const tx = p.transactions.find(t => t.id === txId);
    if (tx) {
      transaction = tx;
      project = p;
      break;
    }
  }

  if (!transaction || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-900 font-semibold mb-4">Transaction not found</p>
          <Button onClick={() => navigate('/official/audit-trails')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Audit Trails
          </Button>
        </div>
      </div>
    );
  }

  const copyHash = async () => {
    await navigator.clipboard.writeText(transaction!.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (type: string) => {
    return type === 'Allocation (SARO)'
      ? 'bg-purple-100 text-purple-800 border-purple-300'
      : 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const formatHash = (hash: string) => {
    return `${hash.substring(0, 16)}...${hash.substring(hash.length - 8)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Transaction Details</h1>
            <p className="text-lg text-slate-600">Blockchain-verified transaction record</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Left Column - Overview Cards */}
          <div className="col-span-2 space-y-6">
            {/* Transaction Info Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-6">Transaction Overview</h2>

              <div className="space-y-4">
                {/* Transaction ID */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Transaction ID</p>
                  <div className="flex items-center gap-3 mt-2">
                    <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded font-mono text-sm text-slate-900">
                      {transaction.id}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(transaction!.id);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="p-2 hover:bg-slate-100 rounded transition-colors"
                    >
                      <Copy className="h-4 w-4 text-slate-600" />
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                  <p className="text-xs font-semibold text-slate-600 uppercase">Amount</p>
                  <p className="text-3xl font-bold text-blue-900 mt-2">
                    ₱{transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Type and Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Type</p>
                    <Badge className={`${getStatusColor(transaction.type)} mt-2 border`}>
                      {transaction.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase">Status</p>
                    <Badge className="bg-green-100 text-green-800 border border-green-300 mt-2">
                      ✓ Confirmed
                    </Badge>
                  </div>
                </div>

                {/* Date and Time */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase">Date & Time (UTC)</p>
                  <p className="text-sm text-slate-900 mt-2 font-mono">
                    {new Date(transaction.date).toISOString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(transaction.date).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Hash Proof Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">SHA-256 Hash Proof</h2>

              <div className="space-y-4">
                {/* Full Hash */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Full Hash</p>
                  <div className="flex items-start gap-3">
                    <code className="flex-1 text-xs font-mono text-slate-900 break-all p-2 bg-white border border-slate-200 rounded">
                      {transaction.hash}
                    </code>
                    <button
                      onClick={copyHash}
                      className="p-2 hover:bg-slate-200 rounded transition-colors flex-shrink-0 mt-2"
                    >
                      {copied ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Copy className="h-5 w-5 text-slate-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Information */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-blue-600 uppercase mb-2">Hash Algorithm</p>
                  <p className="text-sm text-blue-900">SHA-256</p>
                  <p className="text-xs text-blue-700 mt-2">
                    This cryptographic hash uniquely identifies this transaction and proves its integrity on the blockchain.
                  </p>
                </div>
              </div>
            </div>

            {/* Project & Actor Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Project & Actor Information</h2>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase">Project Name</p>
                  <p className="text-sm font-medium text-slate-900 mt-2">{project.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{project.location}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase">Category</p>
                  <Badge className="bg-indigo-100 text-indigo-800 mt-2">
                    {project.category}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase">Recorded By</p>
                  <p className="text-sm font-medium text-slate-900 mt-2">{transaction.recordedBy}</p>
                  <p className="text-xs text-slate-500 mt-1">{transaction.recordedByRole}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase">Description</p>
                  <p className="text-sm text-slate-700 mt-2">{transaction.description}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Quick Actions */}
          <div className="space-y-4">
            {/* Verify Button */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-300 p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-green-200 rounded-full mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-green-700" />
              </div>
              <h3 className="text-center font-semibold text-slate-900 mb-3">Verify on Chain</h3>
              <Button
                onClick={() => window.open(`https://etherscan.io/tx/${transaction.hash}`, '_blank')}
                className="w-full flex items-center justify-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Etherscan
              </Button>
              <p className="text-xs text-slate-600 text-center mt-3">
                View this transaction on the public blockchain explorer
              </p>
            </div>

            {/* Hash Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Hash Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-600">Format:</span>
                  <span className="text-sm font-mono text-slate-900">SHA-256 (256-bit)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-600">Length:</span>
                  <span className="text-sm font-mono text-slate-900">{transaction.hash.length} chars</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-600">Prefix:</span>
                  <span className="text-sm font-mono text-slate-900">
                    {formatHash(transaction.hash)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-600">Algorithm:</span>
                  <span className="text-sm font-mono text-slate-900">HMAC-SHA256</span>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <p className="text-xs font-semibold text-amber-900 uppercase mb-2">Security Note</p>
              <p className="text-xs text-amber-800">
                This transaction has been cryptographically signed and verified on the blockchain. The hash serves as immutable proof of this transaction's authenticity and integrity.
              </p>
            </div>
          </div>
        </div>

        {/* Receipt Section */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
          <TransactionReceipt
            transaction={transaction}
            projectName={project.name}
            projectLocation={project.location}
            recipientName={transaction.recordedBy}
          />
        </div>
      </div>
    </div>
  );
};
