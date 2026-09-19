import React, { useMemo, useState } from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import {
  Archive as ArchiveIcon,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  FileSpreadsheet,
  FileCheck,
  Receipt,
  Layers,
  FileCode,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { MediaLightbox } from '../../components/MediaLightbox';
import { API_BASE_URL } from '../../lib/apiClient';

const ITEMS_PER_PAGE = 10;

const resolveDocumentUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('#')) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;

  try {
    const apiOrigin = new URL(API_BASE_URL).origin;
    return new URL(url, apiOrigin).toString();
  } catch {
    return url;
  }
};

export const Archive = () => {
  const { projects } = useBlockchain();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState<number | null>(null);

  // Flatten documents for easier display and stats
  const allDocuments = useMemo(() => {
    return projects.flatMap((p) =>
      p.documents.map((d) => ({
        ...d,
        projectId: p.id,
        projectName: p.name,
      }))
    );
  }, [projects]);

  // Document repository summary metrics
  const summary = useMemo(() => {
    const total = allDocuments.length;
    const plansAndSpecs = allDocuments.filter((d) => {
      const t = (d.type || '').toLowerCase();
      return t.includes('spec') || t.includes('plan') || t.includes('proposal') || t.includes('blueprint');
    }).length;
    const financialProofs = allDocuments.filter((d) => {
      const t = (d.type || '').toLowerCase();
      return t.includes('saro') || t.includes('receipt') || t.includes('disbursement') || t.includes('nca');
    }).length;
    const reports = allDocuments.filter((d) => {
      const t = (d.type || '').toLowerCase();
      return t.includes('report') || t.includes('inspection') || t.includes('resolution');
    }).length;

    return { total, plansAndSpecs, financialProofs, reports };
  }, [allDocuments]);

  // Available unique document types for filter
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    allDocuments.forEach((d) => {
      if (d.type) types.add(d.type);
    });
    return Array.from(types);
  }, [allDocuments]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return allDocuments.filter((doc) => {
      if (typeFilter !== 'ALL' && (doc.type || '').toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(query);
        const matchesProject = doc.projectName.toLowerCase().includes(query) || doc.projectId.toLowerCase().includes(query);
        const matchesType = (doc.type || '').toLowerCase().includes(query);
        return matchesTitle || matchesProject || matchesType;
      }

      return true;
    });
  }, [allDocuments, typeFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE));
  const paginatedDocuments = filteredDocuments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getFormatIcon = (formatStr?: string) => {
    const f = (formatStr || '').toLowerCase();
    if (f.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    if (f.includes('xls') || f.includes('csv')) return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    if (f.includes('jpg') || f.includes('jpeg') || f.includes('png')) return <FileCheck className="w-4 h-4 text-blue-500" />;
    return <FileCode className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="max-w-7xl mx-auto pb-8 space-y-6">
      {/* ========================================================== */}
      {/* 1. HEADER */}
      {/* ========================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60 shadow-xs">
              <ArchiveIcon className="h-5 w-5" />
            </div>
            Archive & Document Storage
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl">
            Searchable municipal repository for architectural blueprints, SARO allotment orders, milestone photos, and audit certificates.
          </p>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 2. REPOSITORY KPI CARDS */}
      {/* ========================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Documents */}
        <Card
          onClick={() => { setTypeFilter('ALL'); setCurrentPage(1); }}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            typeFilter === 'ALL' ? 'ring-2 ring-blue-500 bg-blue-50/40 border-blue-300' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Archived Documents</span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{summary.total}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Across {projects.length} municipal projects</p>
          </CardContent>
        </Card>

        {/* Specifications & Blueprints */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Plans & Specifications</span>
              <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <FileCode className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-purple-900">{summary.plansAndSpecs}</div>
            <p className="text-[11px] text-purple-600 mt-0.5">Approved technical drawings</p>
          </CardContent>
        </Card>

        {/* Financial & SARO Receipts */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Financial Receipts</span>
              <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-900">{summary.financialProofs}</div>
            <p className="text-[11px] text-amber-600 mt-0.5">SARO and NCA evidence files</p>
          </CardContent>
        </Card>

        {/* Inspection Reports */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Verified Field Reports</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-900">{summary.reports}</div>
            <p className="text-[11px] text-emerald-600 mt-0.5">Physical milestone audits</p>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================== */}
      {/* 3. TABLE CONTROLS & ARCHIVE TABLE */}
      {/* ========================================================== */}
      <Card className="border-slate-200 dark:border-[#1e2334] shadow-sm overflow-hidden bg-white dark:bg-[#121520]">
        <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] bg-slate-50/50 dark:bg-[#141824] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Document Registry</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cryptographically linked attachments, resolutions, and evidence media.
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search input */}
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search title, project..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 text-xs bg-white"
                />
              </div>

              {/* Type filter chips */}
              <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => { setTypeFilter('ALL'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    typeFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                {availableTypes.slice(0, 5).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setTypeFilter(type); setCurrentPage(1); }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                      typeFilter.toLowerCase() === type.toLowerCase()
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-b border-slate-200">
                <TableHead className="text-xs font-bold text-slate-600 py-3">Document Title</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Associated Project</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Document Category</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Upload Date</TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-600 py-3">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDocuments.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-slate-50/80 dark:hover:bg-[#181c2b] transition-colors border-b border-slate-100 dark:border-[#1e2334]">
                  {/* Title & Format Icon */}
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/80">
                        {getFormatIcon(doc.fileFormat || doc.title)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{doc.title}</div>
                        {doc.fileFormat && (
                          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                            {doc.fileFormat}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Project */}
                  <TableCell className="py-3">
                    <div className="font-medium text-slate-900 text-sm">{doc.projectName}</div>
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5">{doc.projectId}</div>
                  </TableCell>

                  {/* Category */}
                  <TableCell className="py-3">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[11px] font-medium border-slate-200">
                      {doc.type || 'General Attachment'}
                    </Badge>
                  </TableCell>

                  {/* Date Uploaded */}
                  <TableCell className="py-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{doc.dateUploaded ? format(new Date(doc.dateUploaded), 'MMM d, yyyy') : 'Archived'}</span>
                    </div>
                  </TableCell>

                  {/* Action */}
                  <TableCell className="text-right py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedDocumentIndex(allDocuments.findIndex((item) => item.id === doc.id))}
                      className="inline-flex h-8 items-center gap-1.5 justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View File</span>
                    </button>
                  </TableCell>
                </TableRow>
              ))}

              {filteredDocuments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-36 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <ArchiveIcon className="h-6 w-6 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">No documents found matching your search.</p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setTypeFilter('ALL');
                        }}
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        Reset filters
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {filteredDocuments.length > ITEMS_PER_PAGE && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-3.5 sm:flex-row">
              <div className="text-xs font-medium text-slate-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredDocuments.length)} of {filteredDocuments.length} documents
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 min-w-8 rounded-md px-2 text-xs font-bold transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDocumentIndex !== null && allDocuments[selectedDocumentIndex] && (
        <MediaLightbox
          items={allDocuments.map((doc) => ({
            type: doc.fileFormat === 'JPEG' || doc.fileFormat === 'PNG' ? 'image' : 'document',
            url: resolveDocumentUrl(doc.url),
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
