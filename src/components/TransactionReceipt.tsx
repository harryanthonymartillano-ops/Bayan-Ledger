import React, { useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Transaction } from '../context/BlockchainContext';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Download, ExternalLink, Copy, CheckCircle } from 'lucide-react';

interface TransactionReceiptProps {
  transaction: Transaction;
  projectName: string;
  projectLocation: string;
  recipientName?: string;
}

export const TransactionReceipt: React.FC<TransactionReceiptProps> = ({
  transaction,
  projectName,
  projectLocation,
  recipientName
}) => {
  const [copied, setCopied] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  // Generate QR code
  useEffect(() => {
    if (qrRef.current) {
      QRCode.toCanvas(qrRef.current, transaction.hash, {
        width: 150,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });
    }
  }, [transaction.hash]);

  const formatHash = (hash: string) => {
    return `${hash.substring(0, 16)}...${hash.substring(hash.length - 8)}`;
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(transaction.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPDF = async () => {
    if (!receiptRef.current) return;
    
    setGenerating(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`Receipt-${transaction.id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
    setGenerating(false);
  };

  const getTxTypeColor = () => {
    return transaction.type === 'Allocation (SARO)'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="space-y-4">
      {/* Preview and Actions */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900">Transaction Receipt</h3>
          <p className="text-sm text-slate-500">{transaction.id}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={downloadPDF}
            disabled={generating}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {generating ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button
            onClick={() => window.open(`https://etherscan.io/tx/${transaction.hash}`, '_blank')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Verify on Chain
          </Button>
        </div>
      </div>

      {/* Receipt Content */}
      <div
        ref={receiptRef}
        className="bg-white border-2 border-slate-300 p-8 rounded-lg shadow-lg"
        style={{ width: '800px' }}
      >
        {/* Header */}
        <div className="text-center border-b-2 border-slate-300 pb-6 mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl font-bold text-slate-900">OFFICIAL RECEIPT</span>
          </div>
          <p className="text-sm text-slate-600">Municipality of Santa Cruz, Laguna</p>
          <p className="text-xs text-slate-500">Blockchain-Verified Transaction</p>
        </div>

        {/* QR Code and Transaction Info */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* QR Code */}
          <div className="flex flex-col items-center justify-start">
            <div className="bg-white p-3 border-2 border-slate-200 rounded-lg">
              <canvas ref={qrRef} />
            </div>
            <p className="text-xs text-slate-500 mt-2">Scan to verify</p>
          </div>

          {/* Transaction Details */}
          <div className="col-span-2 space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase">Receipt Number</p>
              <p className="text-sm font-mono font-bold text-slate-900">{transaction.id}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase">Date & Time</p>
              <p className="text-sm text-slate-900">
                {new Date(transaction.date).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase">Transaction Type</p>
              <Badge className={getTxTypeColor()}>{transaction.type}</Badge>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg mb-8">
          <p className="text-xs font-semibold text-blue-600 uppercase">Amount Processed</p>
          <p className="text-4xl font-bold text-blue-900 mt-2">
            ₱{transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Project & Recipient */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase">Project</p>
            <p className="text-sm font-medium text-slate-900 mt-1">{projectName}</p>
            <p className="text-xs text-slate-500 mt-0.5">{projectLocation}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase">Recorded By</p>
            <p className="text-sm font-medium text-slate-900 mt-1">{transaction.recordedByRole}</p>
            <p className="text-xs text-slate-500 mt-0.5">{transaction.recordedBy}</p>
          </div>
        </div>

        {/* Hash Verification */}
        <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-lg mb-8">
          <p className="text-xs font-semibold text-slate-600 uppercase mb-2">SHA-256 Hash Proof</p>
          <div className="bg-white p-3 rounded border border-slate-200 mb-2">
            <p className="text-xs font-mono text-slate-700 break-all">{transaction.hash}</p>
          </div>
          <p className="text-xs text-slate-500">
            Full transaction hash stored on blockchain for permanent verification
          </p>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-slate-300 pt-6 text-center">
          <p className="text-xs text-slate-600 mb-2">
            This is an official receipt generated by the BayanLedger System
          </p>
          <p className="text-xs text-slate-500">
            Transaction verified and stored on blockchain • {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Hash Management */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
        <p className="text-sm font-semibold text-slate-900 mb-3">Transaction Hash Management</p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={transaction.hash}
            readOnly
            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded text-xs font-mono text-slate-700"
          />
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
