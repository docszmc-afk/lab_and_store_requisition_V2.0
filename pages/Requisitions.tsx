
import React, { useState, useEffect } from 'react';
import { useRequisition } from '../contexts/RequisitionContext';
import { StatusBadge, UrgencyBadge, StageBadge } from '../components/StatusBadge';
import { Search, Filter, Eye, Edit2, AlertCircle, Bell, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { RequisitionStatus, Requisition, WorkflowStage, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDate, isUserTurn } from '../utils';

const Requisitions: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'action'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const { requisitions } = useRequisition();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get filter params from URL
  const statusFilter = searchParams.get('status');
  const urgencyFilter = searchParams.get('urgency');

  // Handle query param for deep linking to Action tab
  useEffect(() => {
    if (searchParams.get('tab') === 'action') {
      setActiveTab('action');
    }
  }, [searchParams]);

  const clearFilters = () => {
    setSearchParams({});
    setActiveTab('all');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, statusFilter, urgencyFilter]);

  // Filter Logic
  const filtered = requisitions.filter(req => {
    // 1. Tab Filter
    if (activeTab === 'action' && !isUserTurn(req, user)) return false;
    
    // 2. Status Filter (From URL)
    if (statusFilter) {
        if (statusFilter === 'Approved') {
            // Group Approved and Fulfilled for general 'Approved' view
            if (req.status !== RequisitionStatus.APPROVED && req.status !== RequisitionStatus.FULFILLED) return false;
        } else if (statusFilter === 'Pending') {
            // Map 'Pending' from Dashboard card to 'Pending Approval' status
            if (req.status !== RequisitionStatus.PENDING) return false;
        } else {
             if (req.status !== statusFilter) return false;
        }
    }

    // 3. Urgency Filter (From URL)
    if (urgencyFilter) {
        // Simple string match, ideally match enum values carefully
        if (req.urgency !== urgencyFilter) return false;
    }

    // 4. Search Filter
    if (searchTerm) {
        return (
            req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (req.id && req.id.includes(searchTerm))
        );
    }
    return true;
  });

  // Calculate Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Calculate count for badge
  const actionCount = requisitions.filter(r => isUserTurn(r, user)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">My Requisitions</h1>
        <div className="flex gap-2">
           <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <Search className="h-5 w-5 text-gray-400" />
             </div>
             <input
               type="text"
               placeholder="Search requests..."
               className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-zankli-orange focus:border-zankli-orange block w-full sm:w-64"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
           {(statusFilter || urgencyFilter) && (
               <button 
                 onClick={clearFilters}
                 className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
               >
                 <X size={16} /> Clear Filters
               </button>
           )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => { setActiveTab('all'); setSearchParams({}); }}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'all'
                ? 'border-zankli-orange text-zankli-orange'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            All Requests ({requisitions.length})
          </button>
          <button
            onClick={() => { setActiveTab('action'); setSearchParams({ tab: 'action' }); }}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'action'
                ? 'border-zankli-orange text-zankli-orange'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Action Required
            {actionCount > 0 && (
                <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">
                    {actionCount}
                </span>
            )}
          </button>
        </nav>
      </div>
      
      {/* Active Filters Display */}
      {(statusFilter || urgencyFilter) && (
          <div className="flex gap-2 items-center text-sm text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200">
              <Filter size={14} />
              <span>Filtering by:</span>
              {statusFilter && <span className="font-bold bg-white px-2 py-0.5 rounded border border-gray-200">{statusFilter}</span>}
              {urgencyFilter && <span className="font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-red-600">{urgencyFilter}</span>}
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden flex flex-col">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {activeTab === 'action' 
                ? "You're all caught up! No actions required."
                : "No requisitions found matching your search."}
          </div>
        ) : (
          <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requisition Details
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requester
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Urgency
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage / Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedItems.map((req) => {
                  const active = isUserTurn(req, user);
                  return (
                    <tr 
                      key={req.id} 
                      onClick={() => navigate(`/requisitions/${req.id}`)}
                      className={`group hover:bg-orange-50/50 cursor-pointer transition-colors ${active ? 'bg-orange-50/30' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-zankli-orange uppercase tracking-wide mb-0.5">{req.type}</span>
                          <span className="text-sm font-medium text-gray-900">{req.title}</span>
                          <span className="text-xs text-gray-500 mt-1">ID: #{req.id.split('-')[1]} • {formatDate(req.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                            {req.requesterName.charAt(0)}
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">{req.requesterName}</p>
                            <p className="text-xs text-gray-500">{req.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <UrgencyBadge level={req.urgency} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2 items-start">
                          <StatusBadge status={req.status} />
                          <StageBadge stage={req.currentStage} />
                          {active && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">
                              <AlertCircle size={10} /> YOUR TURN
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {/* Show Edit button if sent back and current user is owner */}
                          {req.status === RequisitionStatus.RETURNED && user?.id === req.requesterId && (
                             <button 
                               onClick={() => navigate(`/new-request?edit=${req.id}`)}
                               className="text-amber-600 hover:text-amber-900 p-2 rounded-full hover:bg-amber-100 transition-colors"
                               title="Edit Request"
                             >
                              <Edit2 size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => navigate(`/requisitions/${req.id}`)}
                            className="text-zankli-orange hover:text-orange-900 p-2 rounded-full hover:bg-orange-100 transition-colors"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
             <p className="text-sm text-gray-500">
               Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of <span className="font-medium">{filtered.length}</span> results
             </p>
             
             {totalPages > 1 && (
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                   disabled={currentPage === 1}
                   className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                 >
                   <ChevronLeft size={16} />
                 </button>
                 
                 <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === page 
                              ? 'bg-zankli-orange text-white' 
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                            {page}
                        </button>
                    ))}
                 </div>

                 <button 
                   onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                   disabled={currentPage === totalPages}
                   className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                 >
                   <ChevronRight size={16} />
                 </button>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Requisitions;
