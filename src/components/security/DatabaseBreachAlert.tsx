import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { buildSepoliaEtherscanUrl, formatPhpCurrency, isProjectTampered } from '../../lib/projectIntegrity';

interface DatabaseBreachAlertProps {
  databasePrice: number;
  blockchainPrice: number;
  databaseAllocated?: number;
  blockchainAllocated?: number;
  transactionHash?: string | null;
}

export const DatabaseBreachAlert: React.FC<DatabaseBreachAlertProps> = ({
  databasePrice,
  blockchainPrice,
  databaseAllocated,
  blockchainAllocated,
  transactionHash,
}) => {
  const budgetMismatch = isProjectTampered(databasePrice, blockchainPrice);
  const allocatedMismatch =
    databaseAllocated !== undefined &&
    blockchainAllocated !== undefined &&
    isProjectTampered(databaseAllocated, blockchainAllocated);

  const hasMismatch = budgetMismatch || allocatedMismatch;

  if (!hasMismatch) {
    return null;
  }

  const etherscanUrl = buildSepoliaEtherscanUrl(transactionHash);

  const openLedgerVerification = () => {
    if (!etherscanUrl) return;

    const openedWindow = window.open(etherscanUrl, '_blank', 'noopener,noreferrer');
    if (openedWindow) {
      openedWindow.opener = null;
    }
  };

  const mismatchTypes: string[] = [];
  if (budgetMismatch) mismatchTypes.push('Total Project Budget');
  if (allocatedMismatch) mismatchTypes.push('SARO Allocated Funds');

  return (
    <section className="w-full rounded-3xl border-2 border-red-800 bg-red-50 p-6 shadow-lg shadow-red-100">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-red-100 p-3 text-red-800">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">
            Integrity Incident Report
          </p>
          <h2 className="mt-2 text-lg font-extrabold uppercase tracking-wide text-red-950 sm:text-2xl">
            ⚠️ Critical Error: Unauthorized Data Alteration Detected
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-red-950/85 sm:text-base">
            A verification mismatch has been identified between the local municipal server record and the
            immutable blockchain ledger ({mismatchTypes.join(' & ')}). This confirms that the local municipal server entries do not align
            with the decentralized Sepolia record, and the blockchain value should be treated as the
            authoritative public reference.
          </p>

          {/* Budget Mismatch Panel */}
          {budgetMismatch && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-red-900 mb-2">
                Total Budget Discrepancy
              </p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-red-200 bg-red-100/80 p-5">
                  <p className="text-sm font-semibold text-red-800">
                    Database Record (Compromised Data)
                  </p>
                  <p className="mt-3 text-2xl font-bold text-red-900 sm:text-3xl">
                    {formatPhpCurrency(databasePrice)}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-sm font-semibold text-emerald-800">
                    Blockchain Ledger (Immutable / Real Price)
                  </p>
                  <p className="mt-3 text-2xl font-bold text-emerald-700 sm:text-3xl">
                    {formatPhpCurrency(blockchainPrice)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Allocated Funds Mismatch Panel */}
          {allocatedMismatch && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-red-900 mb-2">
                Allocated Funds (SARO) Discrepancy
              </p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-red-200 bg-red-100/80 p-5">
                  <p className="text-sm font-semibold text-red-800">
                    Database Record (Compromised SARO)
                  </p>
                  <p className="mt-3 text-2xl font-bold text-red-900 sm:text-3xl">
                    {formatPhpCurrency(databaseAllocated!)}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-sm font-semibold text-emerald-800">
                    Blockchain Ledger (Immutable / Real SARO)
                  </p>
                  <p className="mt-3 text-2xl font-bold text-emerald-700 sm:text-3xl">
                    {formatPhpCurrency(blockchainAllocated!)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {etherscanUrl && (
            <div className="mt-6">
              <button
                type="button"
                onClick={openLedgerVerification}
                className="inline-flex items-center justify-center rounded-2xl bg-red-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-900 focus-visible:ring-offset-2"
              >
                🌐 Verify Authentic Ledger on Sepolia Etherscan
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DatabaseBreachAlert;
