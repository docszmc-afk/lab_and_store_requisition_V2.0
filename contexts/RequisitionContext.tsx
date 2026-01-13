
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Requisition, UserRole, RequisitionType } from '../types';
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
      child_requisition_ids: req.childRequisitionIds,
      attachments: req.attachments,
      approvals: req.approvals,
      payments: req.payments,
      last_reminded_at: req.lastRemindedAt,
      reminder_count: req.reminderCount
    };

    return payload;
  };

  const fetchRequisitions = async () => {
    if (!user) {
        setRequisitions([]);
        return;
    }

    try {
        const baseColumns = 'id,requester_id,requester_name,department,type,title,created_at,updated_at,status,current_stage,urgency,items,approvals,payments,rejection_reason,parent_id,is_parent,child_requisition_ids';
        
        let { data, error } = await supabase
            .from('requisitions')
            .select(`${baseColumns},last_reminded_at,reminder_count`)
            .order('created_at', { ascending: false });

        if (error) {
            const fallback = await supabase
                .from('requisitions')
                .select(baseColumns)
                .order('created_at', { ascending: false });
            
            data = fallback.data;
            error = fallback.error;
        }

        if (error) {
            console.error('CRITICAL: Error fetching requisitions:', error.message);
            return;
        }

        if (data) {
            const mapped = data.map(row => mapToRequisition(row));
            
            // ROLE-BASED VISIBILITY FILTERING
            const isGlobalRole = [
                UserRole.CHAIRMAN,
                UserRole.AUDIT,
                UserRole.FINANCE,
                UserRole.ACCOUNTS,
                UserRole.ADMIN
            ].includes(user.role);

            if (isGlobalRole) {
                setRequisitions(mapped);
            } else {
                // Define department-specific types
                const labTypes = [
                    RequisitionType.LAB_PURCHASE_ORDER,
                    RequisitionType.EQUIPMENT_REQUEST,
                    RequisitionType.OUTSOURCED_HISTOLOGY_PAYMENT
                ];
                
                const pharmacyTypes = [
                    RequisitionType.PHARMACY_PURCHASE_ORDER,
                    RequisitionType.EMERGENCY_DRUG_PURCHASE_1_MONTH,
                    RequisitionType.EMERGENCY_DRUG_PURCHASE_1_WEEK,
                    RequisitionType.DAILY_DRUG_PURCHASE
                ];

                const filtered = mapped.filter(req => {
                    // Always show if user is the one who created it
                    if (req.requesterId === user.id) return true;

                    // Lab Admin should see everything Lab-related
                    if (user.role === UserRole.LAB) {
                        return labTypes.includes(req.type) || req.department?.toLowerCase().includes('lab');
                    }

                    // Pharmacy Admin should see everything Pharmacy-related
                    if (user.role === UserRole.PHARMACY) {
                        return pharmacyTypes.includes(req.type) || req.department?.toLowerCase().includes('pharm');
                    }

                    // Default fallback: match exact department string
                    return req.department === user.department;
                });
                
                setRequisitions(filtered);
            }
        }
    } catch (err) {
        console.error('Fetch exception:', err);
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
            setRequisitions(prev => prev.filter(r => r.id !== req.id));
            throw error;
        }
    }
  };

  const updateRequisition = async (updatedReq: Requisition) => {
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
