import React from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Archive as ArchiveIcon, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';

export const Archive = () => {
  const { projects } = useBlockchain();

  // Flatten documents for easier display
  const allDocuments = projects.flatMap(p => 
    p.documents.map(d => ({ ...d, projectId: p.id, projectName: p.name }))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <ArchiveIcon className="h-8 w-8 mr-3 text-blue-600" />
          Archive & Documents
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Searchable storage for project files, permits, and receipts.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Document Repository</CardTitle>
          <CardDescription>Access all files linked to blockchain hashes.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Document Title</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date Uploaded</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allDocuments.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-center font-medium text-slate-900">
                      <FileText className="w-4 h-4 mr-2 text-slate-400" />
                      {doc.title}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-900">{doc.projectName}</div>
                    <div className="font-mono text-xs text-slate-500">{doc.projectId}</div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      {doc.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {format(new Date(doc.dateUploaded), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <a 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-slate-100 hover:text-slate-900 h-9 px-3"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      View
                    </a>
                  </TableCell>
                </TableRow>
              ))}
              {allDocuments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                    No documents found in the archive.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
