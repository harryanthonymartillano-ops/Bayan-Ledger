import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

const ITEMS_PER_PAGE = 10;

export type OfficerCategory = 'all' | 'mpdo' | 'budget' | 'treasurer';

export type EnhancedReceiptRow = {
  id: string;
  date: string;
  projectId?: string;
  projectName: string;
  details: string;
  officer: 'mpdo' | 'budget' | 'treasurer';
  officerRole: string;
  actionTitle: string;
  amount: number | null;
  reference?: string;
  hash: string;
  sealHash?: string;
};

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

const shortenHash = (hash: string) => (hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : '');

const parseDetails = (details: string) => {
  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const cleanAction = (action: string) =>
  action
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const classifyOfficer = (
  role: string,
  actionType: string,
  detailsText: string
): 'mpdo' | 'budget' | 'treasurer' | null => {
  const normRole = (role || '').toLowerCase().trim();
  const normAction = (actionType || '').toLowerCase().trim();
  const normDetails = (detailsText || '').toLowerCase().trim();

  // 1. Explicitly ignore system, background, automated, cron, or non-officer actions
  if (
    normRole === 'system' ||
    normRole.includes('automated') ||
    normRole.includes('cron') ||
    normRole.includes('bot') ||
    normAction.includes('heartbeat') ||
    normAction.includes('health') ||
    normAction.includes('sync') ||
    normAction.includes('login') ||
    normAction.includes('logout') ||
    normAction.includes('role change') ||
    normAction.includes('user update') ||
    normAction.includes('integrity check')
  ) {
    return null;
  }

  // 2. Direct Role Match for accountable municipal officers
  if (normRole.includes('mpdc') || normRole.includes('planning') || normRole.includes('mpdo')) {
    return 'mpdo';
  }
  if (normRole.includes('budget') || normRole.includes('mbo')) {
    return 'budget';
  }
  if (normRole.includes('treasurer') || normRole.includes('treasury') || normRole.includes('mto')) {
    return 'treasurer';
  }

  // 3. Specific Action / Particulars Match only if tied to an accountable office
  if (
    normAction.includes('proposal') ||
    normAction.includes('milestone verified') ||
    normAction.includes('project created') ||
    normAction.includes('disbursement request inception') ||
    normDetails.includes('mpdc') ||
    normDetails.includes('planning office')
  ) {
    return 'mpdo';
  }

  if (
    normAction.includes('saro') ||
    normAction.includes('allocation') ||
    normAction.includes('1/2 signed') ||
    normAction.includes('budget sign') ||
    normAction.includes('fund certification') ||
    normDetails.includes('budget officer')
  ) {
    return 'budget';
  }

  if (
    normAction.includes('disbursement') ||
    normAction.includes('nca') ||
    normAction.includes('digital seal') ||
    normAction.includes('treasury seal') ||
    normAction.includes('treasurer executed') ||
    normDetails.includes('treasurer signed') ||
    normDetails.includes('notice of cash allocation')
  ) {
    return 'treasurer';
  }

  // Any other action without accountable officer attribution is excluded
  return null;
};

export const TransactionReceipts = () => {
  const { projects, auditLogs } = useBlockchain();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from search parameters if present
  const initialOfficer = (searchParams.get('officer') as OfficerCategory) || 'all';
  const initialSearch = searchParams.get('search') || '';

  const [officerFilter, setOfficerFilter] = useState<OfficerCategory>(
    ['all', 'mpdo', 'budget', 'treasurer'].includes(initialOfficer) ? initialOfficer : 'all'
  );
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Modal inspection state
  const [selectedReceipt, setSelectedReceipt] = useState<EnhancedReceiptRow | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const receiptPrintRef = useRef<HTMLDivElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Sync state if search params change externally
  useEffect(() => {
    const officerParam = searchParams.get('officer') as OfficerCategory;
    if (officerParam && ['all', 'mpdo', 'budget', 'treasurer'].includes(officerParam)) {
      setOfficerFilter(officerParam);
    }
    const queryParam = searchParams.get('search');
    if (queryParam !== null && queryParam !== searchTerm) {
      setSearchTerm(queryParam);
    }
  }, [searchParams]);

  // Generate QR code when modal opens
  useEffect(() => {
    if (selectedReceipt && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, selectedReceipt.hash || selectedReceipt.id, {
        width: 140,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    }
  }, [selectedReceipt]);

  // Comprehensive receipt harvesting from all projects & audit logs
  const allReceiptRows = useMemo<EnhancedReceiptRow[]>(() => {
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const rows: EnhancedReceiptRow[] = [];
    const seenRowKeys = new Set<string>();

    // 1. Ingest transactions from projects
    projects.forEach((project) => {
      (project.transactions || []).forEach((tx) => {
        const isDisbursement = tx.type.toLowerCase().includes('disbursement') || tx.type.toLowerCase().includes('nca');
        const isAllocation = tx.type.toLowerCase().includes('allocation') || tx.type.toLowerCase().includes('saro');

        // A. Treasurer Execution Receipt (Final disbursement & Digital Seal)
        if (isDisbursement && (tx.hash || tx.digitalSealHash)) {
          const treasurerKey = `treasurer-exec-${tx.id}`;
          if (!seenRowKeys.has(treasurerKey)) {
            seenRowKeys.add(treasurerKey);
            rows.push({
              id: treasurerKey,
              date: tx.treasurerSignedAt || tx.date,
              projectId: project.id,
              projectName: project.name,
              details: `${project.name} | Notice of Cash Allocation (NCA) | ${currencyFormatter.format(tx.amount)}`,
              officer: 'treasurer',
              officerRole: 'Treasurer',
              actionTitle: 'NCA Disbursement Execution',
              amount: tx.amount,
              reference: `TX-${tx.id.slice(-6).toUpperCase()}`,
              hash: tx.hash || tx.digitalSealHash || '',
              sealHash: tx.digitalSealHash,
            });
          }
        }

        // B. Budget Officer Validation Receipt (1st signature / budget certification)
        if (isDisbursement && (tx.budgetSignedAt || tx.signatureCount || tx.requestTxHash)) {
          const budgetKey = `budget-sign-${tx.id}`;
          if (!seenRowKeys.has(budgetKey)) {
            seenRowKeys.add(budgetKey);
            rows.push({
              id: budgetKey,
              date: tx.budgetSignedAt || tx.date,
              projectId: project.id,
              projectName: project.name,
              details: `${project.name} | Fund Certification & 1st Multi-Sig Validation | ${currencyFormatter.format(tx.amount)}`,
              officer: 'budget',
              officerRole: 'Budget Officer',
              actionTitle: 'Budget Multi-Sig Certification',
              amount: tx.amount,
              reference: `REQ-${tx.id.slice(-6).toUpperCase()}`,
              hash: tx.requestTxHash || tx.hash,
              sealHash: undefined,
            });
          }
        }

        // C. MPDO Inception Receipt (Payment request initiated after milestone verified)
        if (isDisbursement && (tx.requestTxHash || tx.recordedByRole === 'MPDC (Planning)')) {
          const mpdoKey = `mpdo-req-${tx.id}`;
          if (!seenRowKeys.has(mpdoKey)) {
            seenRowKeys.add(mpdoKey);
            rows.push({
              id: mpdoKey,
              date: tx.date,
              projectId: project.id,
              projectName: project.name,
              details: `${project.name} | Milestone Disbursement Request Filed | ${currencyFormatter.format(tx.amount)}`,
              officer: 'mpdo',
              officerRole: 'MPDC (Planning)',
              actionTitle: 'Disbursement Request Inception',
              amount: tx.amount,
              reference: `REQ-${tx.id.slice(-6).toUpperCase()}`,
              hash: tx.requestTxHash || tx.hash,
              sealHash: undefined,
            });
          }
        }

        // D. SARO Allocation (Created and certified by Budget Officer)
        if (isAllocation && tx.hash) {
          const saroKey = `saro-alloc-${tx.id}`;
          if (!seenRowKeys.has(saroKey)) {
            seenRowKeys.add(saroKey);
            rows.push({
              id: saroKey,
              date: tx.date,
              projectId: project.id,
              projectName: project.name,
              details: `${project.name} | SARO Capital Allotment Registered | ${currencyFormatter.format(tx.amount)}`,
              officer: 'budget',
              officerRole: 'Budget Officer',
              actionTitle: 'SARO Allotment Release',
              amount: tx.amount,
              reference: `SARO-${tx.id.slice(-6).toUpperCase()}`,
              hash: tx.hash,
              sealHash: undefined,
            });
          }
        }
      });
    });

    // 2. Ingest audit logs with on-chain hashes
    auditLogs.forEach((log) => {
      if (!log.hash) return;

      // Classify accountable municipal officer (MPDO, Budget, or Treasurer)
      const classifiedOfficer = classifyOfficer(log.userRole || '', log.action || '', log.details || '');
      // Strictly exclude system, background, and unclassified logs - only MPDO, Budget, and Treasurer allowed
      if (!classifiedOfficer) return;

      const parsed = parseDetails(log.details);
      const projectId =
        (log.resourceType === 'project' ? log.resourceId : undefined) ||
        (parsed?.projectId ? String(parsed.projectId) : undefined) ||
        (parsed?.project_id ? String(parsed.project_id) : undefined);

      const linkedProject = projectId ? projectById.get(projectId) : undefined;
      const projectName = linkedProject?.name || (parsed?.name ? String(parsed.name) : 'Santa Cruz Municipal Program');

      const amountRaw =
        (typeof parsed?.amount === 'number' && parsed.amount) ||
        (typeof parsed?.disbursedAmount === 'number' && parsed.disbursedAmount) ||
        (typeof parsed?.totalBudget === 'number' && parsed.totalBudget) ||
        null;
      const amount = typeof amountRaw === 'number' ? amountRaw : null;

      const cleanDetails =
        (parsed?.notes ? String(parsed.notes) : null) ||
        (parsed?.reason ? String(parsed.reason) : null) ||
        (parsed?.details ? String(parsed.details) : null) ||
        log.details;

      const reference =
        (parsed?.referenceNumber ? String(parsed.referenceNumber) : null) ||
        (parsed?.saroNumber ? String(parsed.saroNumber) : null) ||
        (parsed?.voucherNumber ? String(parsed.voucherNumber) : null) ||
        (parsed?.checkNumber ? `CHK-${String(parsed.checkNumber)}` : undefined);

      const actionTitle = cleanAction(log.action);

      const displayRole =
        classifiedOfficer === 'mpdo'
          ? 'MPDC (Planning)'
          : classifiedOfficer === 'budget'
            ? 'Budget Officer'
            : 'Treasurer';

      const auditKey = `audit-${log.id}`;
      if (!seenRowKeys.has(auditKey)) {
        seenRowKeys.add(auditKey);
        rows.push({
          id: auditKey,
          date: log.timestamp,
          projectId: projectId || linkedProject?.id,
          projectName,
          details: cleanDetails,
          officer: classifiedOfficer,
          officerRole: displayRole,
          actionTitle,
          amount,
          reference,
          hash: log.hash,
        });
      }
    });

    // Safeguard: strictly filter to ensure only accountable officers (MPDO, Budget, Treasurer) are returned
    return rows
      .filter((r): r is EnhancedReceiptRow => r.officer === 'mpdo' || r.officer === 'budget' || r.officer === 'treasurer')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [projects, auditLogs]);

  // Counts for each officer category
  const officerCounts = useMemo(() => {
    return {
      all: allReceiptRows.length,
      mpdo: allReceiptRows.filter((r) => r.officer === 'mpdo').length,
      budget: allReceiptRows.filter((r) => r.officer === 'budget').length,
      treasurer: allReceiptRows.filter((r) => r.officer === 'treasurer').length,
    };
  }, [allReceiptRows]);

  // Filter rows based on selected officer and search query
  const filteredRows = useMemo(() => {
    let result = allReceiptRows;

    // Filter by officer
    if (officerFilter !== 'all') {
      result = result.filter((row) => row.officer === officerFilter);
    }

    // Filter by search query
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      result = result.filter((row) =>
        [
          row.details,
          row.projectName,
          row.officerRole,
          row.actionTitle,
          row.reference,
          row.hash,
          row.sealHash,
          row.amount ? currencyFormatter.format(row.amount) : '',
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(query))
      );
    }

    return result;
  }, [allReceiptRows, officerFilter, searchTerm]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paginatedRows = filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Handlers
  const handleOfficerTabChange = (officer: OfficerCategory) => {
    setOfficerFilter(officer);
    setCurrentPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (officer === 'all') {
        next.delete('officer');
      } else {
        next.set('officer', officer);
      }
      return next;
    });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    setSearchTerm(val);
    setCurrentPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set('search', val);
      } else {
        next.delete('search');
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setOfficerFilter('all');
    setCurrentPage(1);
    setSearchParams({});
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const generateDirectPdf = (receipt: EnhancedReceiptRow) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    // Double border certificate frame
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, margin, contentWidth, pageHeight - margin * 2, 4, 4);

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin + 2, margin + 2, contentWidth - 4, pageHeight - margin * 2 - 4, 3, 3);

    let y = margin + 12;

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('MUNICIPALITY OF SANTA CRUZ', pageWidth / 2, y, { align: 'center' });

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Province of Laguna • Republic of the Philippines', pageWidth / 2, y, { align: 'center' });

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.text('BAYANLEDGER ON-CHAIN TRANSACTION RECEIPT', pageWidth / 2, y, { align: 'center' });

    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin + 6, y, pageWidth - margin - 6, y);

    y += 7;

    // QR Code on the left
    let qrAdded = false;
    if (qrCanvasRef.current) {
      try {
        const qrDataUrl = qrCanvasRef.current.toDataURL('image/png');
        doc.addImage(qrDataUrl, 'PNG', margin + 6, y, 38, 38);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('SCAN FOR SEPOLIA PROOF', margin + 6 + 19, y + 42, { align: 'center' });
        qrAdded = true;
      } catch (e) {
        console.warn('QR canvas export skipped:', e);
      }
    }

    const detailsX = qrAdded ? margin + 48 : margin + 6;

    let detailsY = y + 2;

    // Receipt ID
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('RECEIPT IDENTIFIER:', detailsX, detailsY);
    detailsY += 4;
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(receipt.id, detailsX, detailsY);

    detailsY += 6.5;
    // Date & Timestamp
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('DATE & TIMESTAMP (PHT):', detailsX, detailsY);
    detailsY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(format(new Date(receipt.date), 'MMMM d, yyyy - HH:mm:ss'), detailsX, detailsY);

    detailsY += 6.5;
    // Officer & Action
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('OFFICER IN CHARGE & ACTION:', detailsX, detailsY);
    detailsY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${receipt.officerRole} — ${receipt.actionTitle}`, detailsX, detailsY);

    y += 48;

    // Financial Box (if amount present)
    if (receipt.amount !== null) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin + 6, y, contentWidth - 12, 17, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('AMOUNT PROCESSED & DISBURSED:', margin + 10, y + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(5, 150, 105);
      doc.text(currencyFormatter.format(receipt.amount), margin + 10, y + 13.5);

      y += 21;
    }

    // Project Details Box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + 6, y, contentWidth - 12, 32, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PROJECT REFERENCE:', margin + 10, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const splitProjectName = doc.splitTextToSize(receipt.projectName, contentWidth - 20);
    doc.text(splitProjectName, margin + 10, y + 10.5);

    const projectOffset = Array.isArray(splitProjectName) ? splitProjectName.length * 4 : 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PARTICULARS / SCOPE OF WORK:', margin + 10, y + 11.5 + projectOffset);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const splitDetails = doc.splitTextToSize(receipt.details, contentWidth - 20);
    doc.text(splitDetails, margin + 10, y + 16 + projectOffset);

    y += 38;

    // Cryptographic Proof Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + 6, y, contentWidth - 12, receipt.sealHash ? 24 : 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('ON-CHAIN TRANSACTION HASH (SHA-256):', margin + 10, y + 5);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    const splitHash = doc.splitTextToSize(receipt.hash, contentWidth - 20);
    doc.text(splitHash, margin + 10, y + 9.5);

    if (receipt.sealHash) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(4, 120, 87);
      doc.text('DIGITAL SEAL OF TRUTH: ' + receipt.sealHash, margin + 10, y + 20);
    }

    y += receipt.sealHash ? 30 : 24;

    // Dual Sign-off lines
    const col1X = margin + 15;
    const col2X = margin + contentWidth / 2 + 10;
    const sigWidth = 65;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(col1X, y + 14, col1X + sigWidth, y + 14);
    doc.line(col2X, y + 14, col2X + sigWidth, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(receipt.officerRole, col1X + sigWidth / 2, y + 19, { align: 'center' });
    doc.text('BayanLedger Smart Contract', col2X + sigWidth / 2, y + 19, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Municipal Signatory', col1X + sigWidth / 2, y + 23, { align: 'center' });
    doc.text('Sepolia Cryptographic Anchor', col2X + sigWidth / 2, y + 23, { align: 'center' });

    // Footer at bottom of document
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Official BayanLedger Transaction Receipt • Verified on Sepolia Ethereum Blockchain • Generated ${new Date().toLocaleString()}`,
      pageWidth / 2,
      pageHeight - margin - 3,
      { align: 'center' }
    );

    doc.save(`StaCruz-Receipt-${receipt.id}.pdf`);
  };

  const handleDownloadPdf = async () => {
    if (!selectedReceipt) return;

    setIsGeneratingPdf(true);
    try {
      // Direct vector PDF generation - 100% reliable, zero CSS oklch errors, crisp print output
      generateDirectPdf(selectedReceipt);
    } catch (error) {
      console.error('Vector PDF generation encountered an error, trying canvas fallback:', error);
      try {
        if (receiptPrintRef.current) {
          const canvas = await html2canvas(receiptPrintRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
          });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const imgWidth = 190;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
          pdf.save(`StaCruz-Receipt-${selectedReceipt.id}.pdf`);
        }
      } catch (fallbackErr) {
        console.error('All PDF generation methods failed:', fallbackErr);
        alert('Could not download PDF. Please use the Print option.');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const getOfficerBadge = (officer: 'mpdo' | 'budget' | 'treasurer', _roleLabel?: string) => {
    switch (officer) {
      case 'mpdo':
        return (
          <Badge className="border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-50 font-medium">
            <Compass className="mr-1 h-3 w-3 text-sky-700" />
            MPDO (Planning)
          </Badge>
        );
      case 'budget':
        return (
          <Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50 font-medium">
            <Banknote className="mr-1 h-3 w-3 text-amber-700" />
            Budget Officer
          </Badge>
        );
      case 'treasurer':
        return (
          <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 font-medium">
            <ShieldCheck className="mr-1 h-3 w-3 text-emerald-700" />
            Treasurer
          </Badge>
        );
    }
  };

  return (
    <div className="bg-[#fafaf9] min-h-[calc(100vh-4rem)] pb-16">
      {/* Clean Naga-Inspired Page Header */}
      <section className="border-b border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Receipt className="h-4 w-4 text-sky-700" />
                <span>Cryptographic Public Ledger</span>
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Officer Transaction Receipts
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Public verification proofs for every peso released by the Municipality of Santa Cruz.
                Inspect individual receipts signed and executed by MPDO, Budget, and Treasury officers,
                or filter by specific municipal office.
              </p>
            </div>
          </div>

          {/* 4 Summary Stat Cards (Filterable shortcuts) */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* All Receipts */}
            <div
              onClick={() => handleOfficerTabChange('all')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                officerFilter === 'all'
                  ? 'border-slate-900 bg-white shadow-sm ring-1 ring-slate-900'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">All Receipts</p>
                <Receipt className="h-4 w-4 text-slate-700" />
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{officerCounts.all}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Total verified on-chain</p>
            </div>

            {/* MPDO Receipts */}
            <div
              onClick={() => handleOfficerTabChange('mpdo')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                officerFilter === 'mpdo'
                  ? 'border-sky-600 bg-white shadow-sm ring-1 ring-sky-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-700">MPDO Planning</p>
                <Compass className="h-4 w-4 text-sky-700" />
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{officerCounts.mpdo}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Proposals & verifications</p>
            </div>

            {/* Budget Receipts */}
            <div
              onClick={() => handleOfficerTabChange('budget')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                officerFilter === 'budget'
                  ? 'border-amber-600 bg-white shadow-sm ring-1 ring-amber-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Budget Office</p>
                <Banknote className="h-4 w-4 text-amber-700" />
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{officerCounts.budget}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">SARO & multi-sig sign-offs</p>
            </div>

            {/* Treasury Receipts */}
            <div
              onClick={() => handleOfficerTabChange('treasurer')}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                officerFilter === 'treasurer'
                  ? 'border-emerald-600 bg-white shadow-sm ring-1 ring-emerald-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Treasury</p>
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
              </div>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{officerCounts.treasurer}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">NCA & Digital Seals</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Ledger Section */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header Controls: Officer Segmented Control Tabs & Search */}
          <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Officer Segmented Control Tabs */}
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => handleOfficerTabChange('all')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    officerFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>All Officers</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-500">
                    {officerCounts.all}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOfficerTabChange('mpdo')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    officerFilter === 'mpdo'
                      ? 'bg-white text-sky-800 shadow-sm'
                      : 'text-slate-600 hover:text-sky-800'
                  }`}
                >
                  <Compass className="h-3.5 w-3.5 text-sky-700" />
                  <span>MPDO (Planning)</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-500">
                    {officerCounts.mpdo}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOfficerTabChange('budget')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    officerFilter === 'budget'
                      ? 'bg-white text-amber-800 shadow-sm'
                      : 'text-slate-600 hover:text-amber-800'
                  }`}
                >
                  <Banknote className="h-3.5 w-3.5 text-amber-700" />
                  <span>Budget Office</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-500">
                    {officerCounts.budget}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOfficerTabChange('treasurer')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    officerFilter === 'treasurer'
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-emerald-800'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Municipal Treasury</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-500">
                    {officerCounts.treasurer}
                  </span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search hash, project name, or particulars..."
                  className="h-9 w-full rounded-lg border-slate-200 bg-slate-50 pl-8 pr-7 text-xs focus-visible:ring-slate-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.delete('search');
                        return next;
                      });
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label="Clear Search"
                  >
                    <span className="text-xs font-bold">✕</span>
                  </button>
                )}
              </div>
            </div>

            {/* Results Status Strip */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span>Filtering by:</span>
                <span className="font-semibold text-slate-900">
                  {officerFilter === 'all'
                    ? 'All Officers'
                    : officerFilter === 'mpdo'
                      ? 'MPDO (Planning Office)'
                      : officerFilter === 'budget'
                        ? 'Municipal Budget Office'
                        : 'Municipal Treasury'}
                </span>
                {searchTerm && <span>matching "{searchTerm}"</span>}
              </div>

              <div className="flex items-center gap-3">
                <span>Showing <strong>{filteredRows.length}</strong> record{filteredRows.length === 1 ? '' : 's'}</span>
                {(officerFilter !== 'all' || searchTerm) && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full table-fixed text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="w-[12%] px-5 py-3">Date</th>
                    <th className="w-[15%] px-5 py-3">Officer</th>
                    <th className="w-[16%] px-5 py-3">Action</th>
                    <th className="w-[28%] px-5 py-3">Project & Details</th>
                    <th className="w-[20%] px-5 py-3">Cryptographic Hash</th>
                    <th className="w-[9%] px-5 py-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedRows.map((row) => {
                    const isCopied = copiedHash === row.hash;
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-slate-50/70">
                        {/* Date */}
                        <td className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-700">
                          {format(new Date(row.date), 'MMM d, yyyy')}
                          <div className="text-[11px] font-normal text-slate-400">{format(new Date(row.date), 'HH:mm')}</div>
                        </td>

                        {/* Officer In-Charge Badge */}
                        <td className="px-5 py-4 align-middle">
                          {getOfficerBadge(row.officer, row.officerRole)}
                        </td>

                        {/* Action Title */}
                        <td className="px-5 py-4 align-middle">
                          <span className="font-semibold text-xs text-slate-900 block">{row.actionTitle}</span>
                          {row.amount ? (
                            <span className="font-mono text-xs font-bold text-emerald-700 mt-0.5 block">
                              {currencyFormatter.format(row.amount)}
                            </span>
                          ) : row.reference ? (
                            <span className="font-mono text-[11px] text-slate-500 mt-0.5 block">
                              {row.reference}
                            </span>
                          ) : null}
                        </td>

                        {/* Project & Details */}
                        <td className="px-5 py-4 align-middle">
                          {row.projectId ? (
                            <Link
                              to={`/project/${row.projectId}`}
                              className="font-bold text-xs text-slate-900 hover:text-sky-700 transition-colors block leading-snug"
                            >
                              {row.projectName}
                            </Link>
                          ) : (
                            <p className="font-bold text-xs text-slate-900 leading-snug">{row.projectName}</p>
                          )}
                          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{row.details}</p>
                        </td>

                        {/* Cryptographic Hash */}
                        <td className="px-5 py-4 align-middle">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-mono text-xs text-sky-800 truncate max-w-[130px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
                              title={row.hash}
                            >
                              {shortenHash(row.hash)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyHash(row.hash)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                              title="Copy Hash"
                            >
                              {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                          {row.sealHash && (
                            <div className="mt-0.5 font-mono text-[10px] text-emerald-700 flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              <span>Seal: {shortenHash(row.sealHash)}</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(row)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            title="Inspect Official Receipt"
                          >
                            <FileText className="h-3 w-3 text-slate-500" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="divide-y divide-slate-100 bg-white lg:hidden">
              {paginatedRows.map((row) => {
                const isCopied = copiedHash === row.hash;
                return (
                  <article key={row.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-400">
                          {format(new Date(row.date), 'MMM d, yyyy HH:mm')}
                        </p>
                        <h3 className="mt-0.5 font-bold text-slate-900 text-sm">
                          {row.projectId ? (
                            <Link to={`/project/${row.projectId}`} className="hover:text-sky-700">
                              {row.projectName}
                            </Link>
                          ) : (
                            row.projectName
                          )}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(row)}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
                      >
                        Receipt
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {getOfficerBadge(row.officer, row.officerRole)}
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {row.actionTitle}
                      </span>
                      {row.amount && (
                        <span className="font-mono text-xs font-bold text-emerald-700">
                          {currencyFormatter.format(row.amount)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">{row.details}</p>

                    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
                      <span className="font-mono text-sky-800 truncate text-[11px]">{shortenHash(row.hash)}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyHash(row.hash)}
                        className="inline-flex items-center gap-1 font-semibold text-slate-600"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Empty State */}
            {filteredRows.length === 0 && (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <p className="mt-3 text-base font-bold text-slate-900">No transaction receipts found</p>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                  We couldn't find receipts matching "{searchTerm}" under{' '}
                  <strong>{officerFilter === 'all' ? 'All Officers' : officerFilter.toUpperCase()}</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* Clean Pagination Controls */}
            {filteredRows.length > ITEMS_PER_PAGE && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:flex-row">
                <p className="text-xs text-slate-500">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} of {filteredRows.length} receipts
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Prev</span>
                  </button>

                  <span className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Official Transaction Receipt Inspection Modal (Teleported to document.body for true full screen) */}
      {selectedReceipt && createPortal((
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 md:p-6 w-screen h-screen overflow-hidden transition-all animate-in fade-in duration-200">
          <div className="flex h-[95vh] w-full max-w-5xl sm:max-w-6xl flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl transition-all">
            {/* Modal Header */}
            <div className="shrink-0 border-b border-slate-100 bg-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 shadow-2xs">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">
                      Official Municipal Receipt
                    </h3>
                    <p className="mt-0.5 max-w-2xl text-xs sm:text-sm text-slate-500">
                      Receipt ID: <span className="font-mono font-semibold text-slate-700">{selectedReceipt.id}</span> &bull; Cryptographically anchored on Ethereum Sepolia.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedReceipt(null)}
                    className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    aria-label="Close Receipt Modal"
                  >
                    <span className="text-xl leading-none">&times;</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-6 md:p-8">
              {/* Printable Receipt Canvas */}
              <div
                ref={receiptPrintRef}
                className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 md:p-10 shadow-sm text-slate-900"
              >
                {/* Municipal Branding & Seal */}
                <div className="text-center border-b border-slate-200 pb-6 mb-6">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 p-1.5 border border-slate-200 mb-3 shadow-2xs">
                    <img src="/logo-bayanledger.png" alt="BayanLedger Logo" className="h-11 w-11 object-contain" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-950 tracking-tight uppercase">MUNICIPALITY OF SANTA CRUZ</h4>
                  <p className="text-xs text-slate-500 font-medium">Province of Laguna &bull; Republic of the Philippines</p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>BayanLedger On-Chain Transaction Receipt</span>
                  </div>
                </div>

                {/* 2-Column Wide Structured Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
                  {/* Left Column: QR Code & Verification Metadata (5 cols) */}
                  <div className="md:col-span-5 flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-5">
                    <div>
                      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                        <canvas ref={qrCanvasRef} />
                        <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-wider">
                          Scan for Sepolia Proof
                        </p>
                      </div>

                      <div className="mt-5 space-y-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Receipt Identifier
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-900 break-all">{selectedReceipt.id}</span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Date & Timestamp
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            {format(new Date(selectedReceipt.date), 'MMMM d, yyyy - HH:mm:ss')} (PHT)
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Action Type
                          </span>
                          <span className="text-xs font-bold text-slate-900">{selectedReceipt.actionTitle}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Officer in Charge
                      </span>
                      <div className="flex items-center gap-2">
                        {getOfficerBadge(selectedReceipt.officer, selectedReceipt.officerRole)}
                        <span className="text-xs font-medium text-slate-500">({selectedReceipt.officerRole})</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Financial Figures & Project Particulars (7 cols) */}
                  <div className="md:col-span-7 flex flex-col justify-between space-y-5">
                    {/* Financial Amount Banner */}
                    {selectedReceipt.amount !== null ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-900 text-white p-5 shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                          Amount Processed & Disbursed
                        </span>
                        <p className="text-3xl font-extrabold tracking-tight mt-1 font-mono text-emerald-400">
                          {currencyFormatter.format(selectedReceipt.amount)}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Authorized under Municipal Investment Allotment & COA Circulars
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Transaction Classification
                        </span>
                        <p className="text-lg font-bold text-slate-900 mt-1">
                          Official Non-Disbursement Sign-off
                        </p>
                      </div>
                    )}

                    {/* Project Information */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-3.5 flex-1">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Project Reference
                        </span>
                        <span className="text-sm font-bold text-slate-900 leading-snug block mt-0.5">
                          {selectedReceipt.projectName}
                        </span>
                        {selectedReceipt.reference && (
                          <span className="mt-1 inline-block text-[11px] font-mono font-medium text-slate-500">
                            Ref: {selectedReceipt.reference}
                          </span>
                        )}
                      </div>

                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Particulars / Scope of Action
                        </span>
                        <p className="text-xs text-slate-600 leading-relaxed mt-1 font-normal">
                          {selectedReceipt.details}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cryptographic Proof Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>On-Chain Cryptographic Proof (SHA-256 Hash)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyHash(selectedReceipt.hash)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                    >
                      {copiedHash === selectedReceipt.hash ? 'Copied!' : 'Copy Hash'}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-slate-800 break-all bg-white p-3 rounded-lg border border-slate-200 select-all">
                    {selectedReceipt.hash}
                  </p>
                  {selectedReceipt.sealHash && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-mono text-emerald-800">
                      <span><strong>Digital Seal of Truth:</strong> {selectedReceipt.sealHash}</span>
                      <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase">Immutable</span>
                    </div>
                  )}
                </div>

                {/* Dual Officer Sign-off Block */}
                <div className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-6 text-center">
                  <div>
                    <div className="mx-auto w-48 border-b-2 border-slate-300 pb-1 mb-1.5">
                      <span className="text-xs font-bold text-slate-900">{selectedReceipt.officerRole}</span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Authorized Municipal Signatory</p>
                    <p className="text-[10px] text-slate-400">Municipality of Santa Cruz, Laguna</p>
                  </div>
                  <div>
                    <div className="mx-auto w-48 border-b-2 border-slate-300 pb-1 mb-1.5">
                      <span className="text-xs font-bold text-slate-900">BayanLedger Smart Contract</span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Sepolia Cryptographic Anchor</p>
                    <p className="text-[10px] text-slate-400">Consensus Verifiable &bull; Zero Tampering</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Footer Bar */}
            <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <a
                href={`https://sepolia.etherscan.io/tx/${selectedReceipt.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Verify on Sepolia Etherscan</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};
