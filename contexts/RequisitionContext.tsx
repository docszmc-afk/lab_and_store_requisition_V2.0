
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Requisition } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface RequisitionContextType {
  requisitions: Requisition[];
  addRequisition: (req: Requisition) => Promise<void>;
  updateRequisition: (req: Requisition) => Promise<void>;
  deleteRequisition: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const RequisitionContext = createContext<RequisitionContextType | undefined>(undefined);

export const RequisitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const { user } = useAuth();

  // Mapper: DB Row (snake_case) -> Requisition (camelCase)
  const mapToRequisition = (row: any): Requisition => {
    // Defensive JSON parsing
    let items = [];
    if (Array.isArray(row.items)) items = row.items;
    else if (typeof row.items === 'string') {
        try { items = JSON.parse(row.items); } catch(e) { console.warn('Failed to parse items for req', row.id); }
    }

    // Attachments should ideally be empty in list view for performance
    let attachments = [];
    if (Array.isArray(row.attachments)) attachments = row.attachments;
    else if (typeof row.attachments === 'string') {
        try { attachments = JSON.parse(row.attachments); } catch(e) {}
    }

    let approvals = [];
    if (Array.isArray(row.approvals)) approvals = row.approvals;
    else if (typeof row.approvals === 'string') {
        try { approvals = JSON.parse(row.approvals); } catch(e) {}
    }

    let payments = [];
    if (Array.isArray(row.payments)) payments = row.payments;
    else if (typeof row.payments === 'string') {
        try { payments = JSON.parse(row.payments); } catch(e) {}
    }

    return {
      id: row.id,
      requesterId: row.requester_id,
      requesterName: row.requester_name,
      department: row.department,
      type: row.type,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      currentStage: row.current_stage,
      urgency: row.urgency,
      items: items,
      attachments: attachments, 
      approvals: approvals,
      payments: payments,
      rejectionReason: row.rejection_reason,
      parentId: row.parent_id,
      isParent: row.is_parent,
      childRequisitionIds: row.child_requisition_ids,
      lastRemindedAt: row.last_reminded_at,
      reminderCount: row.reminder_count
    };
  };

  // Mapper: Requisition (camelCase) -> DB Row (snake_case)
  const mapFromRequisition = (req: Requisition) => {
    const payload: any = {
      id: req.id,
      requester_id: req.requesterId,
      requester_name: req.requesterName,
      department: req.department,
      type: req.type,
      title: req.title,
      created_at: req.createdAt,
      updated_at: req.updatedAt,
      status: req.status,
      current_stage: req.currentStage,
      urgency: req.urgency,
      items: req.items,
      rejection_reason: req.rejectionReason,
      parent_id: req.parentId,
      is_parent: req.isParent,
      child_requisition_ids: req.childRequisitionIds
    };

    // Only include heavy fields if they are actually present in the object
    if (req.attachments !== undefined) payload.attachments = req.attachments;
    if (req.approvals !== undefined) payload.approvals = req.approvals;
    if (req.payments) payload.payments = req.payments;
    if (req.lastRemindedAt) payload.last_reminded_at = req.lastRemindedAt;
    if (req.reminderCount !== undefined) payload.reminder_count = req.reminderCount;

    return payload;
  };

  const fetchRequisitions = async () => {
    if (!user) {
        setRequisitions([]);
        return;
    }

    try {
        // PERFORMANCE CRITICAL: 
        // We explicitly define columns to exclude 'attachments'.
        // This makes the query lightweight and fast.
        
        // Strategy 1: Ideal Query (Includes reminder columns)
        const idealColumns = 'id,requester_id,requester_name,department,type,title,created_at,updated_at,status,current_stage,urgency,items,approvals,payments,rejection_reason,parent_id,is_parent,child_requisition_ids,last_reminded_at,reminder_count';
        
        // Strategy 2: Safe Fallback (Excludes reminder columns if migration hasn't run yet, BUT STILL EXCLUDES ATTACHMENTS)
        const safeColumns = 'id,requester_id,requester_name,department,type,title,created_at,updated_at,status,current_stage,urgency,items,approvals,payments,rejection_reason,parent_id,is_parent,child_requisition_ids';

        let { data, error } = await supabase
            .from('requisitions')
            .select(idealColumns)
            .order('created_at', { ascending: false });

        // If ideal query fails (likely due to missing reminder columns), use safe fallback
        if (error) {
            console.warn('Optimized fetch failed (likely schema mismatch). Trying safe fetch without reminder columns.', error);
            const fallback = await supabase
                .from('requisitions')
                .select(safeColumns) // STILL NO ATTACHMENTS!
                .order('created_at', { ascending: false });
            
            data = fallback.data;
            error = fallback.error;
        }

        if (error) {
            console.error('Error fetching requisitions:', JSON.stringify(error));
            return;
        }

        if (data && data.length > 0) {
            const mapped = data.reduce((acc: Requisition[], row: any) => {
                try {
                    const req = mapToRequisition(row);
                    acc.push(req);
                } catch (e) {
                    console.error('Failed to map requisition row:', row, e);
                }
                return acc;
            }, []);
            setRequisitions(mapped);
        } else {
            setRequisitions([]); 
        }
    } catch (err) {
        console.error('Fetch exception:', err);
        setRequisitions([]);
    }
  };

  useEffect(() => {
    fetchRequisitions();

    const subscription = supabase
      .channel('public:requisitions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requisitions' }, () => {
        fetchRequisitions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const addRequisition = async (req: Requisition) => {
    setRequisitions(prev => [req, ...prev]);

    if (user) {
        const { error } = await supabase
            .from('requisitions')
            .insert([mapFromRequisition(req)]);

        if (error) {
            console.error('Error adding requisition to DB:', error);
            // Revert on failure
            setRequisitions(prev => prev.filter(r => r.id !== req.id));
            alert(`Failed to save: ${error.message}`); 
            throw error;
        }
    }
  };

  const updateRequisition = async (updatedReq: Requisition) => {
    // Optimistic UI update
    setRequisitions(prev => prev.map(req => req.id === updatedReq.id ? updatedReq : req));

    if (user) {
        const { error } = await supabase
            .from('requisitions')
            .update(mapFromRequisition(updatedReq))
            .eq('id', updatedReq.id);

        if (error) {
            console.error('Error updating requisition in DB:', error);
            // We could revert here, but for now we just log
        }
    }
  };

  const deleteRequisition = async (id: string) => {
    setRequisitions(prev => prev.filter(req => req.id !== id));
    
    if (user) {
        const { error } = await supabase
            .from('requisitions')
            .delete()
            .eq('id', id);

        if (error) console.error('Error deleting requisition:', error);
    }
  };

  return (
    <RequisitionContext.Provider value={{ requisitions, addRequisition, updateRequisition, deleteRequisition, refresh: fetchRequisitions }}>
      {children}
    </RequisitionContext.Provider>
  );
};

export const useRequisition = () => {
  const context = useContext(RequisitionContext);
  if (context === undefined) {
    throw new Error('useRequisition must be used within a RequisitionProvider');
  }
  return context;
};
