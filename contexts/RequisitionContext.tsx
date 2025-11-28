
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
  const mapToRequisition = (row: any): Requisition => ({
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
    items: row.items || [],
    // Attachments and Approvals might be missing in the light fetch
    attachments: row.attachments || [],
    approvals: row.approvals || [],
    payments: row.payments || [],
    rejectionReason: row.rejection_reason,
    parentId: row.parent_id,
    isParent: row.is_parent,
    childRequisitionIds: row.child_requisition_ids
  });

  // Mapper: Requisition (camelCase) -> DB Row (snake_case)
  const mapFromRequisition = (req: Requisition) => {
    // Only include fields that are defined to avoid overwriting with null/undefined if we are working with partial data
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

    // Only add heavy fields or optional fields if they exist to prevent issues
    if (req.attachments !== undefined) payload.attachments = req.attachments;
    if (req.approvals !== undefined) payload.approvals = req.approvals;
    // Explicitly handle payments to ensure we don't send undefined
    if (req.payments) payload.payments = req.payments;

    return payload;
  };

  const fetchRequisitions = async () => {
    // If not logged in yet, don't fetch from DB to avoid RLS errors
    if (!user) {
        setRequisitions([]);
        return;
    }

    try {
        // PERFORMANCE FIX: Select specific columns EXCLUDING 'attachments' and 'approvals' (base64 data)
        // This ensures the list loads instantly. Full data is fetched in detail view.
        const { data, error } = await supabase
            .from('requisitions')
            .select(`
              id, requester_id, requester_name, department, type, title, 
              created_at, updated_at, status, current_stage, urgency, 
              rejection_reason, parent_id, is_parent, child_requisition_ids, items, payments
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching requisitions:', error);
            return;
        }

        if (data && data.length > 0) {
            const mapped = data.map(mapToRequisition);
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

    // Setup Realtime Subscription
    const subscription = supabase
      .channel('public:requisitions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requisitions' }, (payload) => {
        // On any change, refetch to sync
        fetchRequisitions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const addRequisition = async (req: Requisition) => {
    // Optimistic Update
    setRequisitions(prev => [req, ...prev]);

    if (user) {
        const { error } = await supabase
            .from('requisitions')
            .insert([mapFromRequisition(req)]);

        if (error) {
            console.error('Error adding requisition to DB:', error);
            // Revert optimistic update on failure to avoid ghost items
            setRequisitions(prev => prev.filter(r => r.id !== req.id));
            // IMPORTANT: Throw error so calling component knows it failed
            throw new Error(error.message);
        }
    }
  };

  const updateRequisition = async (updatedReq: Requisition) => {
    // Optimistic Update
    setRequisitions(prev => prev.map(req => req.id === updatedReq.id ? updatedReq : req));

    if (user) {
        const { error } = await supabase
            .from('requisitions')
            .update(mapFromRequisition(updatedReq))
            .eq('id', updatedReq.id);

        if (error) {
            console.error('Error updating requisition in DB:', error);
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
