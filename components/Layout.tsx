
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Menu, Bell, CheckCircle, AlertCircle, Clock, Info, X, Zap, ChevronRight, TriangleAlert } from 'lucide-react';
import Sidebar from './Sidebar';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRequisition } from '../contexts/RequisitionContext';
import { useAuth } from '../contexts/AuthContext';
import { RequisitionStatus, WorkflowStage, UserRole } from '../types';
import { formatDateTime, isUserTurn } from '../utils';

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getHeaderTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/requisitions': return 'All Requisitions';
      case '/new-request': return 'New Requisition';
      case '/settings': return 'Settings';
      default: return 'Zankli App';
    }
  };

  // Simplified: If it is your turn AND the reminder count is > 0, you MUST see the alert.
  const urgentReminders = useMemo(() => {
      if (!user) return [];
      return requisitions.filter(r => {
          // 1. Is it currently my turn to sign this?
          const isMyTurn = isUserTurn(r, user);
          // 2. Has the requester sent at least one reminder?
          const hasReminder = (r.reminderCount && r.reminderCount > 0);
          
          return isMyTurn && hasReminder;
      });
  }, [requisitions, user]);

  return (
    <div className="flex h-screen bg-zankli-cream overflow-hidden flex-col">
      
      {/* PERSISTENT GLOBAL EMERGENCY ALERT BAR - HIGH VISIBILITY */}
      {urgentReminders.length > 0 && (
          <div className="bg-red-700 text-white py-4 px-6 z-[100] flex items-center justify-between shadow-2xl sticky top-0 border-b-4 border-white animate-in slide-in-from-top duration-500">
             <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-full text-red-700 shadow-md animate-bounce">
                    <TriangleAlert size={24} fill="currentColor" />
                </div>
                <div className="flex flex-col">
                    <span className="font-black uppercase tracking-widest text-lg leading-none">Emergency Attention Required!</span>
                    <span className="text-sm opacity-95 font-bold mt-1">You have {urgentReminders.length} file(s) marked as URGENT awaiting your signature.</span>
                </div>
             </div>
             <button 
                onClick={() => navigate(`/requisitions/${urgentReminders[0].id}`)}
                className="bg-white text-red-700 px-6 py-2.5 rounded-xl font-black text-sm uppercase hover:bg-red-50 transition-all shadow-xl flex items-center gap-2 whitespace-nowrap active:scale-95 border-2 border-red-700 hover:border-red-800"
             >
                Review Critical Request <ChevronRight size={18} strokeWidth={4} />
             </button>
          </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white border-b border-stone-200 h-16 flex items-center justify-between px-4 sm:px-6 z-30">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-gray-500 hover:bg-gray-100"><Menu size={24} /></button>
                <h2 className="text-xl font-bold text-gray-800">{getHeaderTitle()}</h2>
              </div>
              <div className="flex items-center gap-4">
                 <div className="relative" ref={notifRef}>
                   <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 relative">
                     <Bell size={24} />
                     {(urgentReminders.length > 0) && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                   </button>
                 </div>
                 <div className="hidden sm:flex items-center gap-2 pl-4 border-l">
                    <div className="w-8 h-8 rounded-full bg-zankli-orange text-white flex items-center justify-center font-bold text-sm">{user?.name?.charAt(0)}</div>
                 </div>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto w-full">{children}</div>
            </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
