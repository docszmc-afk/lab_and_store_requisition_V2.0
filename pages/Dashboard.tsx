
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
import { Package, Clock, CheckCircle, FileText, TrendingUp, DollarSign, Filter, BellRing, ChevronRight, AlertCircle, RefreshCcw } from 'lucide-react';
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

  // --- ACCOUNTS DASHBOARD ---
  if (user?.role === UserRole.ACCOUNTS) {
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
                {/* Recent Approved Requisitions (Limited to 20) */}
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-[500px]">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <FileText size={18} /> Completed Requisitions
                        </h3>
                        {accountStats.approvedReqs.length > 20 && (
                            <button onClick={() => navigate('/requisitions')} className="text-sm text-zankli-orange font-medium hover:underline">View All</button>
                        )}
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
                                {accountStats.approvedReqs.slice(0, 20).map(req => {
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
                </div>

                {/* Item Purchase Report */}
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-[500px]">
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
  return (
    <div className="space-y-8">
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

      {/* Action Required Card (Only if needed) */}
      {stats.actionRequired > 0 && (
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
        {/* Recent Requisitions List (Limited to 20) */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 flex flex-col h-[400px]">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Recent Requisitions</h3>
            {stats.total > 20 && (
                <button 
                    onClick={() => navigate('/requisitions')} 
                    className="text-sm text-zankli-orange hover:text-orange-700 font-medium flex items-center gap-1"
                >
                    View All <ChevronRight size={16} />
                </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {requisitions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <FileText size={48} className="mb-2 opacity-20" />
                <p>No requisitions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {requisitions.slice(0, 20).map((req) => (
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
        </div>

        {/* Status Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 h-[400px]">
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
