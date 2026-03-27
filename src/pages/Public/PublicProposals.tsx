import React, { useState } from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, ThumbsUp, PlusCircle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

export const PublicProposals = () => {
  const { proposals, addProposal, upvoteProposal } = useBlockchain();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newProposal, setNewProposal] = useState({ title: '', description: '', author: '' });

  const sortedProposals = [...proposals].sort((a, b) => b.votes - a.votes);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProposal.title || !newProposal.description || !newProposal.author) return;
    
    addProposal(newProposal);
    setNewProposal({ title: '', description: '', author: '' });
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
            <Users className="h-8 w-8 mr-3 text-blue-600" />
            Citizen Proposals
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Suggest and vote on infrastructure projects for our community.
          </p>
        </div>
        <button
          onClick={() => setIsSubmitting(true)}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Submit Proposal
        </button>
      </div>

      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50">
              <div>
                <h3 className="text-xl font-bold text-blue-900">New Project Proposal</h3>
                <p className="text-sm text-blue-700 mt-1">Submit your idea for a community infrastructure project.</p>
              </div>
              <button onClick={() => setIsSubmitting(false)} className="text-slate-400 hover:text-slate-600 self-start">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Title</label>
                <input
                  type="text"
                  required
                  value={newProposal.title}
                  onChange={e => setNewProposal({...newProposal, title: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  placeholder="e.g., Repair of Basketball Court Roof"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description & Justification</label>
                <textarea
                  required
                  rows={3}
                  value={newProposal.description}
                  onChange={e => setNewProposal({...newProposal, description: e.target.value})}
                  className="flex w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  placeholder="Why is this project needed? Who will benefit?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={newProposal.author}
                  onChange={e => setNewProposal({...newProposal, author: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSubmitting(false)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700 h-10 py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4"
                >
                  Submit to MPDC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedProposals.map((p) => (
          <Card key={p.id} className="border-slate-200 shadow-sm flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className={
                  p.status === 'Approved for Planning' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                  p.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                  p.status === 'Under Review' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-slate-50 text-slate-700'
                }>
                  {p.status}
                </Badge>
                <span className="text-xs text-slate-400 font-mono">{p.id}</span>
              </div>
              <CardTitle className="text-lg leading-tight">{p.title}</CardTitle>
              <CardDescription className="text-xs mt-1">Proposed by {p.author}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-between">
              <p className="text-sm text-slate-600 mb-6 line-clamp-3">{p.description}</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center text-slate-700 font-medium">
                  <ThumbsUp className="w-4 h-4 mr-2 text-blue-500" />
                  {p.votes} votes
                </div>
                <button 
                  onClick={() => upvoteProposal(p.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
                >
                  Upvote
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
