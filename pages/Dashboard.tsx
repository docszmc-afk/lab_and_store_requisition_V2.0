
import React, { useMemo, useState } from 'react';
import { useRequisition } from '../contexts/RequisitionContext';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Package, Clock, CheckCircle, FileText, TrendingUp, DollarSign, Filter, BellRing, ChevronRight, AlertCircle, RefreshCcw, ChevronLeft, Zap, ArrowRight } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { RequisitionStatus, UserRole } from '../types';
import { formatDate, isUserTurn } from '../utils';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { requisitions, refresh } = useRequisition();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reportFilter, setReportFilter] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination State
  const [generalPage, setGeneralPage] = useState(1);
  const [accountsPage, setAccountsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800); // Visual feedback
  };

  // Compute Stats
  const stats = useMemo(() => {
    const total = requisitions.length;
    const pending = requisitions.filter(r => r.status === RequisitionStatus.PENDING).length;
    const approved = requisitions.filter(r => r.status === RequisitionStatus.APPROVED || r.status === RequisitionStatus.FULFILLED).length;
    const urgent = requisitions.filter(r => r.urgency === 'Critical' || r.urgency === 'High').length;
    const actionRequired = requisitions.filter(r => isUserTurn(r, user)).length;
    
    return { total, pending, approved, urgent, actionRequired };
  }, [requisitions, user]);

  // Urgent Reminders Logic
  const urgentReminders = useMemo(() => {
      if (!user) return [];
      return requisitions.filter(r => {
          if (!isUserTurn(r, user)) return false;
          // Check if reminded (count > 0)
          if (r.reminderCount && r.reminderCount > 0) {
               // Ensure it hasn't been updated since the reminder
               if (r.lastRemindedAt && r.updatedAt && new Date(r.updatedAt) > new Date(r.lastRemindedAt)) return false;
               return true;
          }
          return false;
      });
  }, [requisitions, user]);

  // Accounts Specific Aggregations
  const accountStats = useMemo(() => {
    const approvedReqs = requisitions.filter(r => r.status === RequisitionStatus.APPROVED || r.status === RequisitionStatus.FULFILLED);
    
    let totalCommitment = 0;
    let totalPaid = 0;
    
    // Aggregation for Reports
    const itemReport: Record<string, { qty: number; spend: number; count: number }> = {};

    approvedReqs.forEach(req => {
        const reqTotal = req.items.reduce((sum, item) => sum + ((item.unitPrice || 0) * item.quantity), 0);
        totalCommitment += reqTotal;
        
        const reqPaid = req.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        totalPaid += reqPaid;

        // Item Aggregation
        req.items.forEach(item => {
            if (!itemReport[item.name]) {
                itemReport[item.name] = { qty: 0, spend: 0, count: 0 };
            }
            itemReport[item.name].qty += item.quantity;
            itemReport[item.name].spend += (item.unitPrice || 0) * item.quantity;
            itemReport[item.name].count += 1;
        });
    });

    return {
        totalCommitment,
        totalPaid,
        outstanding: totalCommitment - totalPaid,
        approvedReqs,
        itemReport: Object.entries(itemReport).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.spend - a.spend)
    };
  }, [requisitions]);

  // Chart Data
  const statusData = [
    { name: 'Pending', value: stats.pending, color: '#f59e0b' },
    { name: 'Approved', value: stats.approved, color: '#10b981' },
    { name: 'Rejected', value: requisitions.filter(r => r.status === RequisitionStatus.REJECTED).length, color: '#ef4444' },
  ];

  // Helper for Pagination Logic
  const getPaginatedData = (data: any[], page: number) => {
     const start = (page - 1) * ITEMS_PER_PAGE;
     return data.slice(start, start + ITEMS_PER_PAGE);
  };
  
  const getTotalPages = (totalItems: number) => Math.ceil(totalItems / ITEMS_PER_PAGE);

  const PaginationControls = ({ page, totalItems, setPage }: { page: number, totalItems: number, setPage: (p: number) => void }) => {
      const totalPages = getTotalPages(totalItems);
      if (totalPages <= 1) return null;

      return (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                  <button 
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                      <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                      <ChevronRight size={16} />
                  </button>
              </div>
          </div>
      );
  };

  // --- ACCOUNTS DASHBOARD ---
  if (user?.role === UserRole.ACCOUNTS) {
    const paginatedAccountsReqs = getPaginatedData(accountStats.approvedReqs, accountsPage);

    return (
        <div className="space-y-8">
             {/* Header */}
             <div className="bg-gradient-to-r from-zankli-black to-zinc-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Accounts Dashboard</h1>
                        <p className="text-gray-300">Financial overview and procurement reports.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                            title="Refresh Dashboard"
                        >
                            <RefreshCcw size={20} className={`${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="hidden md:block bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                            <p className="text-xs text-gray-400 uppercase tracking-wider">Total Commitments</p>
                            <p className="text-2xl font-bold font-mono">₦{accountStats.totalCommitment.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Financial Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div 
                    onClick={() => navigate('/requisitions?status=Approved')}
                    className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 cursor-pointer hover:border-zankli-orange transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Package size={24} /></div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Approved Requisitions</p>
                            <p className="text-2xl font-bold text-gray-900">{accountStats.approvedReqs.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg"><DollarSign size={24} /></div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Payments Made</p>
                            <p className="text-2xl font-bold text-gray-900">₦{accountStats.totalPaid.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg"><TrendingUp size={24} /></div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Outstanding Balance</p>
                            <p className="text-2xl font-bold text-gray-900">₦{accountStats.outstanding.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Approved Requisitions */}
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-[550px]">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <FileText size={18} /> Completed Requisitions
                        </h3>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {paginatedAccountsReqs.map(req => {
                                    const total = req.items.reduce((sum, i) => sum + ((i.unitPrice || 0) * i.quantity), 0);
                                    const paid = req.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                                    return (
                                        <tr key={req.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{req.title}</p>
                                                <p className="text-xs text-gray-500">{req.type}</p>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                                                ₦{total.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-green-600">
                                                ₦{paid.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => navigate(`/requisitions/${req.id}`)} className="text-zankli-orange hover:bg-orange-50 p-1.5 rounded">
                                                    <ChevronRight size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls page={accountsPage} totalItems={accountStats.approvedReqs.length} setPage={setAccountsPage} />
                </div>

                {/* Item Purchase Report */}
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-[550px]">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <TrendingUp size={18} /> Item Purchase Report
                        </h3>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Filter items..." 
                                className="text-xs border border-gray-300 rounded-lg pl-2 pr-2 py-1"
                                value={reportFilter}
                                onChange={(e) => setReportFilter(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty Bought</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Spend</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {accountStats.itemReport
                                    .filter(i => i.name.toLowerCase().includes(reportFilter.toLowerCase()))
                                    .slice(0, 20)
                                    .map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                                        <td className="px-6 py-4 text-center text-sm text-gray-600">{item.qty}</td>
                                        <td className="px-6 py-4 text-right text-sm font-bold text-zankli-orange">₦{item.spend.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // --- GENERAL DASHBOARD (Staff, Admin, Chairman, Audit) ---
  const paginatedRequisitions = getPaginatedData(requisitions, generalPage);

  return (
    <div className="space-y-8">
      {/* URGENT REMINDERS BANNER - High Visibility */}
      {urgentReminders.length > 0 && (
          <div className="bg-red-600 rounded-2xl p-6 shadow-xl shadow-red-200 border-l-8 border-white animate-in slide-in-from-top-4 duration-500">
             <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5 text-white">
                    <div className="p-3 bg-white/20 rounded-full animate-pulse">
                        <Zap size={32} fill="currentColor" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold uppercase tracking-wide">Action Required!</h2>
                        <p className="text-red-100 font-medium text-lg">
                            You have <span className="font-bold underline">{urgentReminders.length} urgent request(s)</span> pending your signature.
                        </p>
                    </div>
                </div>
                <div className="w-full md:w-auto flex flex-col gap-2">
                    <button 
                        onClick={() => navigate(`/requisitions/${urgentReminders[0].id}`)}
                        className="bg-white text-red-600 hover:bg-red-50 px-8 py-3 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                        Review Now <ArrowRight size={20} />
                    </button>
                </div>
             </div>
             {/* Preview of the first urgent item */}
             <div className="mt-4 pt-4 border-t border-red-500/50 flex items-center justify-between text-white/90 text-sm">
                 <div className="flex items-center gap-2">
                     <AlertCircle size={16} />
                     <span className="font-bold">Urgent:</span> {urgentReminders[0].title}
                 </div>
                 <span>From: {urgentReminders[0].requesterName}</span>
             </div>
          </div>
      )}

      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-zankli-orange to-orange-600 rounded-2xl p-8 text-white shadow-lg shadow-orange-900/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name}</h1>
            <p className="text-orange-100">Here's what's happening with your requisitions today.</p>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
            title="Refresh Dashboard"
          >
            <RefreshCcw size={20} className={`${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Required Card (Standard) */}
      {stats.actionRequired > 0 && urgentReminders.length === 0 && (
        <div 
            onClick={() => navigate('/requisitions?tab=action')}
            className="bg-white border-l-4 border-zankli-orange rounded-xl shadow-sm p-6 flex items-center justify-between animate-in fade-in slide-in-from-top-4 cursor-pointer hover:bg-orange-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 text-zankli-orange rounded-full">
              <BellRing size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Action Required</h3>
              <p className="text-sm text-gray-500">You have {stats.actionRequired} requisition(s) waiting for your approval or review.</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-zankli-orange text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors">
            View Items
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Requests', value: stats.total, icon: FileText, color: 'bg-blue-50 text-blue-600', link: '/requisitions' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'bg-amber-50 text-amber-600', link: '/requisitions?status=Pending' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'bg-green-50 text-green-600', link: '/requisitions?status=Approved' },
          { label: 'Urgent', value: stats.urgent, icon: AlertCircle, color: 'bg-red-50 text-red-600', link: '/requisitions?urgency=Critical' },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
                key={index} 
                onClick={() => navigate(stat.link)}
                className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 hover:border-zankli-orange cursor-pointer transition-all hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Requisitions List - Now with Pagination */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col h-[550px]">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Recent Requisitions</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {requisitions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <FileText size={48} className="mb-2 opacity-20" />
                <p>No requisitions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {paginatedRequisitions.map((req) => (
                  <div 
                    key={req.id} 
                    onClick={() => navigate(`/requisitions/${req.id}`)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-10 rounded-full ${
                        req.status === RequisitionStatus.APPROVED ? 'bg-green-500' :
                        req.status === RequisitionStatus.REJECTED ? 'bg-red-500' :
                        'bg-amber-500'
                      }`}></div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{req.title}</p>
                        <p className="text-xs text-gray-500">{req.type} • {formatDate(req.createdAt)}</p>
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Pagination Footer */}
          <PaginationControls page={generalPage} totalItems={requisitions.length} setPage={setGeneralPage} />
        </div>

        {/* Status Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 h-[550px]">
          <h3 className="font-bold text-gray-900 mb-6">Request Status Overview</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
