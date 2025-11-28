import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Menu, Bell, CheckCircle, AlertCircle, Clock, Info, X } from 'lucide-react';
import Sidebar from './Sidebar';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRequisition } from '../contexts/RequisitionContext';
import { useAuth } from '../contexts/AuthContext';
import { RequisitionStatus, WorkflowStage, UserRole } from '../types';
import { formatDateTime } from '../utils';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const { requisitions } = useRequisition();
  const { user } = useAuth();

  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine header title based on route
  const getHeaderTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/requisitions': return 'All Requisitions';
      case '/new-request': return 'New Requisition';
      case '/settings': return 'Settings';
      default: return 'Zankli App';
    }
  };

  // Generate Notifications based on real-time data
  const notifications = useMemo(() => {
    if (!user) return [];
    const list: any[] = [];

    requisitions.forEach(req => {
        // 1. ACTION REQUIRED (For Approvers or Returned Requests)
        let isMyTurn = false;
        
        // If Pending, check if stage matches user role
        if (req.status === RequisitionStatus.PENDING) {
             if (req.currentStage === WorkflowStage.CHAIRMAN_INITIAL && user.role === UserRole.CHAIRMAN) isMyTurn = true;
             else if (req.currentStage === WorkflowStage.STORE_CHECK && user.role === UserRole.PHARMACY) isMyTurn = true;
             else if ((req.currentStage === WorkflowStage.AUDIT_ONE || req.currentStage === WorkflowStage.AUDIT_TWO) && user.role === UserRole.AUDIT) isMyTurn = true;
             else if (req.currentStage === WorkflowStage.CHAIRMAN_FINAL && user.role === UserRole.CHAIRMAN) isMyTurn = true;
             else if (req.currentStage === WorkflowStage.HOF_APPROVAL && user.role === UserRole.FINANCE) isMyTurn = true;
        } else if (req.status === RequisitionStatus.RETURNED && req.requesterId === user.id) {
            isMyTurn = true;
        }

        if (isMyTurn) {
            list.push({
                id: `act_${req.id}`,
                type: 'ACTION',
                title: req.status === RequisitionStatus.RETURNED ? 'Request Returned' : 'Approval Required',
                msg: `${req.title} is waiting for your input.`,
                time: req.updatedAt,
                link: `/requisitions/${req.id}`
            });
        }

        // 2. UPDATES (For Requester)
        if (req.requesterId === user.id && req.status !== RequisitionStatus.DRAFT) {
            // Simple logic: if updated recently (last 24h) and not action required
            const isRecent = new Date(req.updatedAt).getTime() > Date.now() - 86400000;
            if (isRecent && !isMyTurn) {
                 list.push({
                    id: `upd_${req.id}`,
                    type: 'UPDATE',
                    title: `Request ${req.status}`,
                    msg: `${req.title} is now at ${req.currentStage || 'Completed'}.`,
                    time: req.updatedAt,
                    link: `/requisitions/${req.id}`
                });
            }
        }
    });

    return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [requisitions, user]);

  return (
    <div className="flex h-screen bg-zankli-cream overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-stone-200 h-16 flex items-center justify-between px-4 sm:px-6 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-gray-800">{getHeaderTitle()}</h2>
          </div>

          <div className="flex items-center gap-4">
             {/* Notification Bell */}
             <div className="relative" ref={notifRef}>
               <button 
                 onClick={() => setShowNotifications(!showNotifications)}
                 className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 relative"
               >
                 <Bell size={24} />
                 {notifications.length > 0 && (
                   <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                 )}
               </button>

               {/* Dropdown */}
               {showNotifications && (
                 <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-stone-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                       <h3 className="font-semibold text-gray-900">Notifications</h3>
                       <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <CheckCircle size={32} className="mx-auto mb-2 text-gray-300" />
                          <p>You're all caught up!</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            onClick={() => {
                                setShowNotifications(false);
                                navigate(notif.link);
                            }}
                            className="p-4 border-b border-gray-50 hover:bg-orange-50 cursor-pointer transition-colors flex gap-3"
                          >
                             <div className={`mt-1 p-2 rounded-full ${notif.type === 'ACTION' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                {notif.type === 'ACTION' ? <AlertCircle size={16} /> : <Info size={16} />}
                             </div>
                             <div>
                               <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
                               <p className="text-xs text-gray-600 mt-0.5">{notif.msg}</p>
                               <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
                                 <Clock size={10} />
                                 <span>{formatDateTime(notif.time)}</span>
                               </div>
                             </div>
                          </div>
                        ))
                      )}
                    </div>
                 </div>
               )}
             </div>
             
             {/* User Avatar (Desktop) */}
             <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-gray-200">
                <div className="w-8 h-8 rounded-full bg-zankli-orange text-white flex items-center justify-center font-bold text-sm">
                  {user?.name?.charAt(0)}
                </div>
             </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;