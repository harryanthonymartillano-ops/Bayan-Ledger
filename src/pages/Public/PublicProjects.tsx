import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Search, MapPin, Activity, CheckCircle, Clock } from 'lucide-react';

export const PublicProjects = () => {
  const { projects } = useBlockchain();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Infrastructure', 'Health', 'Education', 'Social Services'];

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed': return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle className="w-3 h-3 mr-1"/> Completed</Badge>;
      case 'Milestone Verified': return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600"><Activity className="w-3 h-3 mr-1"/> Verified</Badge>;
      case 'In Progress': return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600"><Activity className="w-3 h-3 mr-1"/> Ongoing</Badge>;
      case 'Allocated': return <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-200"><Activity className="w-3 h-3 mr-1"/> Allocated</Badge>;
      case 'Pending': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>;
      case 'On Hold': return <Badge variant="destructive"><Activity className="w-3 h-3 mr-1"/> On Hold</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          Projects Portal
        </h1>
        <p className="max-w-2xl mt-4 mx-auto text-lg text-slate-500">
          Browse and track all municipal projects. Transparency at your fingertips.
        </p>
        <div className="mt-8 max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center bg-white rounded-full shadow-sm border border-slate-200 p-2 w-full">
            <Search className="h-5 w-5 text-slate-400 ml-3" />
            <Input 
              type="text" 
              placeholder="Search projects by name or location..." 
              className="border-0 focus-visible:ring-0 shadow-none text-base w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="flex h-12 w-full sm:w-48 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredProjects.map(project => (
          <Link to={`/project/${project.id}`} key={project.id} className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-blue-200">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  {getStatusBadge(project.status)}
                  <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">ID: {project.id}</span>
                </div>
                <CardTitle className="text-xl group-hover:text-blue-600 transition-colors line-clamp-2">
                  {project.name}
                </CardTitle>
                <CardDescription className="flex items-center mt-2 text-slate-500">
                  <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span className="truncate">{project.location}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-500 font-medium">Total Budget</span>
                      <span className="font-bold text-slate-900">{formatCurrency(project.totalBudget)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Allocated (SARO)</span>
                        <span className="font-medium text-blue-600">{formatCurrency(project.allocatedFunds)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (project.allocatedFunds / project.totalBudget) * 100)}%` }}></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Disbursed (NCA)</span>
                        <span className="font-medium text-emerald-600">{formatCurrency(project.disbursedFunds)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (project.disbursedFunds / project.totalBudget) * 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-500 text-lg">No projects found matching your search.</p>
        </div>
      )}
    </div>
  );
};
