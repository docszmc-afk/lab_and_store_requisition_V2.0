
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserRole, WorkflowStage, RequisitionItem, Approval, Requisition, RequisitionStatus, RequisitionType, Payment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useRequisition } from '../contexts/RequisitionContext';
import { StatusBadge, UrgencyBadge, StageBadge } from '../components/StatusBadge';
import { ArrowLeft, Upload, CheckCircle, XCircle, AlertCircle, ShoppingBag, Truck, Tag, DollarSign, Split, Printer, Download, Clock, RefreshCcw, PenTool, GitBranch, FileCheck, Plus, Receipt, Edit3, ExternalLink, ArrowRight } from 'lucide-react';
import SignatureModal from '../components/SignatureModal';
import FilePreview from '../components/FilePreview';
import { formatDateTime, formatDate, numberToWords, fileToBase64 } from '../utils';
import { supabase } from '../lib/supabase';

// Declarations for html2pdf
declare var html2pdf: any;

const RequisitionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requisitions, updateRequisition, addRequisition } = useRequisition();
  
  // Local state to hold the FULL requisition data (including attachments/approvals)
  const [localReq, setLocalReq] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch full details on mount or ID change
  // REMOVED 'requisitions' from dependency array to prevent input glitches and infinite loops
  useEffect(() => {
    let isMounted = true;

    const fetchFullDetails = async () => {
      if (!id) return;
      
      // 1. OPTIMISTIC LOAD: Try to find data in context first
      const contextReq = requisitions.find(r => r.id === id);
      
      if (contextReq) {
        if (isMounted) {
            setLocalReq(contextReq);
            // If the context object has items, it's likely complete enough to show immediately
            if (contextReq.items && contextReq.items.length > 0) {
                setLoading(false);
            } else {
                // If it's a "lite" object from the list fetch, keep loading true while we fetch details
                setLoading(true);
            }
        }
      } else {
        if (isMounted) {
            setLocalReq(null);
            setLoading(true);
        }
      }

      // 2. FETCH LATEST FROM DB (Always fetch to ensure attachments/approvals are full)
      try {
        const { data, error } = await supabase
          .from('requisitions')
          .select('*')
          .eq('id', id)
          .single();

        if (isMounted) {
           if (data && !error) {
             const fullData: Requisition = {
               id: data.id,
               requesterId: data.requester_id,
               requesterName: data.requester_name,
               department: data.department,
               type: data.type,
               title: data.title,
               createdAt: data.created_at,
               updatedAt: data.updated_at,
               status: data.status,
               currentStage: data.current_stage,
               urgency: data.urgency,
               items: data.items || [],
               attachments: data.attachments || [],
               approvals: data.approvals || [],
               payments: data.payments || [],
               rejectionReason: data.rejection_reason,
               parentId: data.parent_id,
               isParent: data.is_parent,
               childRequisitionIds: data.child_requisition_ids
             };
             setLocalReq(fullData);
             setLoading(false);
           } else {
              // If DB fetch failed/empty (and possibly no contextReq), stop loading so "Not Found" can render
              setLoading(false);
           }
        }
      } catch (err) {
        console.error("Error loading full details:", err);
        if (isMounted) {
            setLoading(false); // Stop loading if failed
        }
      }
    };

    fetchFullDetails();
    
    return () => { isMounted = false; };
  }, [id]); // Fixed: Removed requisitions dependency
  
  const req = localReq;
  
  // Action State
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'APPROVE' | 'REJECT' | 'RETURN' | null>(null);
  
  // State for Equipment Request & Daily Drug Purchase Chairman routing
  const [nextAuditStage, setNextAuditStage] = useState<WorkflowStage.AUDIT_ONE | WorkflowStage.AUDIT_TWO | null>(null);
  const [isDirectApproval, setIsDirectApproval] = useState(false);

  // --- ACCOUNTS PAYMENT STATE ---
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentFile, setPaymentFile] = useState<{name: string, url: string} | null>(null);

  // Helper Flags
  const isEquipmentRequest = req?.type === RequisitionType.EQUIPMENT_REQUEST;
  const isDailyDrugPurchase = req?.type === RequisitionType.DAILY_DRUG_PURCHASE;
  const isHistology = req?.type === RequisitionType.OUTSOURCED_HISTOLOGY_PAYMENT;
  const isPharmacyPO = req?.type === RequisitionType.PHARMACY_PURCHASE_ORDER;
  const isEmergencyDrug1Month = req?.type === RequisitionType.EMERGENCY_DRUG_PURCHASE_1_MONTH;
  const isEmergencyDrug1Week = req?.type === RequisitionType.EMERGENCY_DRUG_PURCHASE_1_WEEK;
  const isLabPO = req?.type === RequisitionType.LAB_PURCHASE_ORDER;

  // Check if current user is "Store" and stage is "Store Check"
  const isStoreCheck = user?.role === UserRole.PHARMACY && req?.currentStage === WorkflowStage.STORE_CHECK;
  const isChairmanCheck = user?.role === UserRole.CHAIRMAN && req?.currentStage === WorkflowStage.CHAIRMAN_INITIAL;
  
  // Approver Check (General)
  const isApprover = !isStoreCheck && (
    (user?.role === UserRole.CHAIRMAN && (req?.currentStage === WorkflowStage.CHAIRMAN_INITIAL || req?.currentStage === WorkflowStage.CHAIRMAN_FINAL)) ||
    (user?.role === UserRole.AUDIT && (req?.currentStage === WorkflowStage.AUDIT_ONE || req?.currentStage === WorkflowStage.AUDIT_TWO)) ||
    (user?.role === UserRole.FINANCE && req?.currentStage === WorkflowStage.HOF_APPROVAL)
  );
  
  const isAccountView = user?.role === UserRole.ACCOUNTS && (req?.status === RequisitionStatus.APPROVED || req?.status === RequisitionStatus.FULFILLED);

  const isTurn = useMemo(() => {
    if (!req || !user) return false;
    if (req.status === RequisitionStatus.RETURNED && req.requesterId === user.id) return true;
    
    if (req.status === RequisitionStatus.PENDING) {
      switch (req.currentStage) {
        case WorkflowStage.CHAIRMAN_INITIAL: return user.role === UserRole.CHAIRMAN;
        case WorkflowStage.STORE_CHECK: return user.role === UserRole.PHARMACY;
        case WorkflowStage.AUDIT_ONE: return user.role === UserRole.AUDIT;
        case WorkflowStage.AUDIT_TWO: return user.role === UserRole.AUDIT;
        case WorkflowStage.CHAIRMAN_FINAL: return user.role === UserRole.CHAIRMAN;
        case WorkflowStage.HOF_APPROVAL: return user.role === UserRole.FINANCE;
        default: return false;
      }
    }
    return false;
  }, [req, user]);

  const grandTotal = useMemo(() => {
    if (!req) return 0;
    return req.items.reduce((sum, item) => {
      if (item.isAvailable !== false) { 
        return sum + ((item.unitPrice || 0) * item.quantity);
      }
      return sum;
    }, 0);
  }, [req]);
  
  const totalPaid = useMemo(() => {
    return req?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  }, [req?.payments]);

  // Safe getter for child IDs
  const getChildIds = () => {
    if (!req?.childRequisitionIds) return [];
    if (Array.isArray(req.childRequisitionIds)) return req.childRequisitionIds;
    if (typeof req.childRequisitionIds === 'string') {
        const str = req.childRequisitionIds as string;
        // Postgres array {id1,id2}
        if (str.startsWith('{')) return str.replace(/[{}]/g, '').split(',').map(s => s.trim().replace(/"/g, ''));
        // JSON string ["id1"]
        if (str.startsWith('[')) {
             try { return JSON.parse(str); } catch (e) { return []; }
        }
        return [str];
    }
    return [];
  };

  const childIds = getChildIds();

  // Navigation Helper
  const handleBack = () => {
    if (req?.parentId) {
      navigate(`/requisitions/${req.parentId}`);
    } else {
      navigate('/requisitions');
    }
  };

  // --- OPTIMIZED INPUT HANDLING ---
  // Updates local state immediately for UI responsiveness
  const handleLocalUpdate = (itemId: string, field: keyof RequisitionItem, value: any) => {
    if (!localReq) return;
    const updatedItems = localReq.items.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    );
    setLocalReq({ ...localReq, items: updatedItems });
  };

  // Persists changes to DB on blur (focus loss) to prevent constant reloading
  const handlePersistUpdate = async () => {
    if (localReq) {
        await updateRequisition(localReq);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && req) {
      const file = e.target.files[0];
      try {
        const base64 = await fileToBase64(file);
        const updatedReq = {
          ...req,
          attachments: [
            ...(req.attachments || []), 
            { name: file.name, url: base64, type: file.type }
          ]
        };
        setLocalReq(updatedReq);
        updateRequisition(updatedReq);
      } catch (error) {
        console.error("Upload failed", error);
        alert("Failed to upload attachment");
      }
    }
  };

  const handlePaymentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        const base64 = await fileToBase64(file);
        setPaymentFile({ name: file.name, url: base64 });
      } catch (error) {
        console.error("Upload failed", error);
        alert("Failed to upload payment proof");
      }
    }
  };

  const handleAddPayment = () => {
      if (!req || !user || !paymentAmount) return;

      const newPayment: Payment = {
          id: `pay_${Date.now()}`,
          amount: Number(paymentAmount),
          date: new Date().toISOString(),
          recordedBy: user.name,
          notes: paymentNote,
          evidenceUrl: paymentFile?.url
      };

      const updatedReq = {
          ...req,
          payments: [...(req.payments || []), newPayment]
      };
      setLocalReq(updatedReq);
      updateRequisition(updatedReq);

      setPaymentAmount('');
      setPaymentNote('');
      setPaymentFile(null);
      setShowPaymentForm(false);
  };

  const handleApprove = (destination?: WorkflowStage.AUDIT_ONE | WorkflowStage.AUDIT_TWO) => {
    setIsDirectApproval(false);
    if (destination) {
      setNextAuditStage(destination);
    } else {
      setNextAuditStage(null);
    }
    setPendingAction('APPROVE');
    setShowSignatureModal(true);
  }

  const handleDirectApprove = () => {
    setIsDirectApproval(true);
    setNextAuditStage(null);
    setPendingAction('APPROVE');
    setShowSignatureModal(true);
  }

  const handleReject = () => {
    setPendingAction('REJECT');
    setShowSignatureModal(true);
  }

  const handleReturn = () => {
    setPendingAction('RETURN');
    setShowSignatureModal(true);
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('requisition-content');
    if (!element || !req) {
        alert("Content not ready for download. Please wait for page to fully load.");
        return;
    }

    const opt = {
      margin: 10,
      filename: `${req.parentId ? 'PO' : 'Requisition'}_${req.id.split('-')[1] || req.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        letterRendering: true,
        scrollY: -window.scrollY 
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save();
  };

  const performFinalSplit = async (approvedReq: Requisition) => {
    try {
        setIsProcessing(true);
        
        // Group items by supplier
        const groups: Record<string, RequisitionItem[]> = {};
        approvedReq.items.forEach(item => {
          if (item.isAvailable !== false) {
            const supplier = (item.supplier || 'Unassigned').trim();
            if (!groups[supplier]) groups[supplier] = [];
            groups[supplier].push(item);
          }
        });

        const suppliers = Object.keys(groups);
        if (suppliers.length === 0) {
            await updateRequisition(approvedReq);
            setIsProcessing(false);
            return;
        }

        const generatedChildIds: string[] = [];

        for (const [index, supplier] of suppliers.entries()) {
          const itemsForSupplier = groups[supplier].map(i => ({...i}));
          const childId = `PO-${Date.now()}-${index}`; 
          generatedChildIds.push(childId);

          // Construct child request with CLEAN properties
          const childReq: Requisition = {
            id: childId,
            // FIX: Use current user ID as requester to pass RLS, or fall back to original. 
            // In most systems, the 'creator' of the split PO is the Approver/Admin.
            requesterId: user?.id || approvedReq.requesterId,
            requesterName: approvedReq.requesterName, // Keep original name for reference if needed
            department: approvedReq.department,
            type: approvedReq.type,
            title: `PO: ${supplier} - ${approvedReq.title}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: RequisitionStatus.APPROVED, 
            currentStage: WorkflowStage.COMPLETED,
            urgency: approvedReq.urgency,
            items: itemsForSupplier,
            attachments: approvedReq.attachments || [],
            // Ensure payments is undefined to avoid DB issues on insert and avoid copying parent payments
            payments: undefined, 
            
            parentId: approvedReq.id,
            isParent: false,
            childRequisitionIds: [],
            approvals: approvedReq.approvals.map(a => ({...a, id: `app_${Date.now()}_${Math.random()}`})),
            rejectionReason: undefined
          };
          
          // Wrap in try-catch to ensure we catch individual failures
          try {
              await addRequisition(childReq);
          } catch (err) {
              console.error(`Failed to create split PO for ${supplier}:`, err);
              throw new Error(`Failed to create PO for ${supplier}. Please try again.`);
          }
        }

        const finalParentReq: Requisition = {
          ...approvedReq,
          status: RequisitionStatus.FULFILLED,
          isParent: true,
          childRequisitionIds: generatedChildIds,
          updatedAt: new Date().toISOString()
        };
        
        setLocalReq(finalParentReq);
        await updateRequisition(finalParentReq);
        
        setIsProcessing(false);
        alert(`Requisition Finalized! Split into ${suppliers.length} Professional Purchase Order(s). Links are available above.`);
        
    } catch (e: any) {
        console.error("Split processing failed:", e);
        setIsProcessing(false);
        alert(`Error: ${e.message || "Failed to save split Purchase Orders."} Check your connection.`);
    }
  };

  const handleSignatureConfirm = async (type: 'DRAWN' | 'STAMP', data: string, comment?: string) => {
    if (!req || !user) return;
    
    const newApproval: Approval = {
      id: `app_${Date.now()}`,
      approverId: user.id,
      approverName: user.name,
      role: user.role,
      department: user.department,
      stage: req.currentStage || WorkflowStage.CHAIRMAN_INITIAL,
      timestamp: new Date().toISOString(),
      signatureType: type,
      signatureData: data,
      comment: comment 
    };

    let updatedReq: Requisition = { ...req, approvals: [...(req.approvals || []), newApproval] };
    let alertMessage = '';

    if (pendingAction === 'REJECT') {
      updatedReq.status = RequisitionStatus.REJECTED;
      updatedReq.rejectionReason = comment;
      updatedReq.currentStage = WorkflowStage.COMPLETED; 
      alertMessage = "Requisition Rejected.";
      
    } else if (pendingAction === 'RETURN') {
      updatedReq.status = RequisitionStatus.RETURNED;
      updatedReq.currentStage = WorkflowStage.DRAFT_EDIT;
      updatedReq.rejectionReason = comment;
      alertMessage = "Requisition Returned to Creator.";

    } else {
      let nextStage = req.currentStage;

      if (isEmergencyDrug1Month) {
        if (req.currentStage === WorkflowStage.AUDIT_TWO) nextStage = WorkflowStage.AUDIT_ONE;
        else if (req.currentStage === WorkflowStage.AUDIT_ONE) nextStage = WorkflowStage.CHAIRMAN_FINAL;
        else if (req.currentStage === WorkflowStage.CHAIRMAN_FINAL) nextStage = WorkflowStage.HOF_APPROVAL;
        else if (req.currentStage === WorkflowStage.HOF_APPROVAL) nextStage = WorkflowStage.COMPLETED;
      } 
      else if (isEmergencyDrug1Week) {
        if (req.currentStage === WorkflowStage.AUDIT_ONE) nextStage = WorkflowStage.CHAIRMAN_FINAL;
        else if (req.currentStage === WorkflowStage.CHAIRMAN_FINAL) nextStage = WorkflowStage.COMPLETED;
        else if (req.currentStage === WorkflowStage.REQUESTER) nextStage = WorkflowStage.AUDIT_ONE;
      }
      else if (isHistology) {
          if (req.currentStage === WorkflowStage.AUDIT_ONE || req.currentStage === WorkflowStage.AUDIT_TWO) {
              nextStage = WorkflowStage.CHAIRMAN_FINAL;
          } else if (req.currentStage === WorkflowStage.CHAIRMAN_FINAL) {
              nextStage = WorkflowStage.COMPLETED;
          } else if (req.currentStage === WorkflowStage.REQUESTER) {
              nextStage = WorkflowStage.AUDIT_ONE;
          }
      } else if (isPharmacyPO) {
          if (req.currentStage === WorkflowStage.AUDIT_ONE) {
              nextStage = WorkflowStage.CHAIRMAN_FINAL;
          } else if (req.currentStage === WorkflowStage.CHAIRMAN_FINAL) {
              nextStage = WorkflowStage.COMPLETED;
          } else if (req.currentStage === WorkflowStage.REQUESTER) {
              nextStage = WorkflowStage.AUDIT_ONE;
          }
      } else if (isEquipmentRequest || isDailyDrugPurchase) {
          if (req.currentStage === WorkflowStage.CHAIRMAN_INITIAL) {
              if (isDirectApproval) {
                  nextStage = WorkflowStage.COMPLETED;
              } else {
                  nextStage = nextAuditStage || WorkflowStage.AUDIT_ONE;
              }
          } else if (req.currentStage === WorkflowStage.AUDIT_ONE || req.currentStage === WorkflowStage.AUDIT_TWO) {
              nextStage = WorkflowStage.CHAIRMAN_FINAL;
          } else if (req.currentStage === WorkflowStage.CHAIRMAN_FINAL) {
              nextStage = WorkflowStage.COMPLETED;
          }
      } else {
          // Standard Lab PO Flow
          if (req.currentStage === WorkflowStage.CHAIRMAN_INITIAL) nextStage = WorkflowStage.STORE_CHECK;
          else if (req.currentStage === WorkflowStage.STORE_CHECK) nextStage = WorkflowStage.AUDIT_ONE;
          else if (req.currentStage === WorkflowStage.AUDIT_ONE) nextStage = WorkflowStage.CHAIRMAN_FINAL;
          else if (req.currentStage === WorkflowStage.CHAIRMAN_FINAL) nextStage = WorkflowStage.COMPLETED;
      }

      updatedReq.currentStage = nextStage;
      
      // If completed, finalize status
      if (nextStage === WorkflowStage.COMPLETED) {
        updatedReq.status = RequisitionStatus.APPROVED;
        
        // SPECIAL LOGIC: Split Lab POs
        if (isLabPO) {
            setShowSignatureModal(false);
            await performFinalSplit(updatedReq);
            return; 
        }
      }
      alertMessage = "Requisition Approved and Signed!";
    }

    setLocalReq(updatedReq);
    await updateRequisition(updatedReq);
    setShowSignatureModal(false);

    alert(alertMessage);
    navigate('/requisitions');
  };

  const getApprovalForStage = (stage: WorkflowStage) => {
    return req?.approvals?.find(a => a.stage === stage);
  };
  
  const auditRecommendation = useMemo(() => {
    if (!req) return null;
    const auditApproval = req.approvals?.find(a => 
      (a.stage === WorkflowStage.AUDIT_ONE || a.stage === WorkflowStage.AUDIT_TWO) && a.comment
    );
    return auditApproval;
  }, [req]);

  const isBoxActive = (stage: WorkflowStage) => {
    if (!user || !req) return false;
    if (req.currentStage === stage) {
      if (stage === WorkflowStage.CHAIRMAN_INITIAL && user.role === UserRole.CHAIRMAN) return true;
      if (stage === WorkflowStage.STORE_CHECK && user.role === UserRole.PHARMACY) return true;
      if (stage === WorkflowStage.AUDIT_ONE && user.role === UserRole.AUDIT) return true;
      if (stage === WorkflowStage.AUDIT_TWO && user.role === UserRole.AUDIT) return true;
      if (stage === WorkflowStage.CHAIRMAN_FINAL && user.role === UserRole.CHAIRMAN) return true;
      if (stage === WorkflowStage.HOF_APPROVAL && user.role === UserRole.FINANCE) return true;
    }
    return false;
  };

  const getApprovalChain = () => {
    if (isEmergencyDrug1Month) {
      return [
        { label: 'APPLICANT\'S (NAME & SIGN)', stage: WorkflowStage.REQUESTER, role: 'Requester' },
        { label: 'CONFIRMED BY (AUDIT 2)', stage: WorkflowStage.AUDIT_TWO, role: 'Audit' },
        { label: 'CONFIRMED BY (AUDIT 1)', stage: WorkflowStage.AUDIT_ONE, role: 'Audit' },
        { label: 'APPROVED BY (CHAIRMAN)', stage: WorkflowStage.CHAIRMAN_FINAL, role: 'Chairman' },
        { label: 'FINAL APPROVAL (FINANCE)', stage: WorkflowStage.HOF_APPROVAL, role: 'Finance' }
      ];
    }
    if (isEmergencyDrug1Week) {
      return [
        { label: 'APPLICANT\'S (NAME & SIGN)', stage: WorkflowStage.REQUESTER, role: 'Requester' },
        { label: 'CONFIRMED BY (AUDIT 1)', stage: WorkflowStage.AUDIT_ONE, role: 'Audit' },
        { label: 'APPROVED BY (CHAIRMAN)', stage: WorkflowStage.CHAIRMAN_FINAL, role: 'Chairman' }
      ];
    }
    if (isHistology || isPharmacyPO) {
      return [
        { label: 'Requested By', stage: WorkflowStage.REQUESTER, role: 'Requester' },
        { label: 'Audit Verification', stage: WorkflowStage.AUDIT_ONE, role: 'Audit' },
        { label: 'Final Approval', stage: WorkflowStage.CHAIRMAN_FINAL, role: 'Chairman' },
      ];
    }

    const steps = [
      { label: 'Requested By', stage: WorkflowStage.REQUESTER, role: 'Requester' },
      { label: 'Chairman (Initial)', stage: WorkflowStage.CHAIRMAN_INITIAL, role: 'Chairman' },
    ];

    if (isEquipmentRequest || isDailyDrugPurchase) {
      const audit2Approval = getApprovalForStage(WorkflowStage.AUDIT_TWO);
      const audit1Approval = getApprovalForStage(WorkflowStage.AUDIT_ONE);
      
      const isDirectlyApproved = req?.status === RequisitionStatus.APPROVED && !audit1Approval && !audit2Approval;

      if (!isDirectlyApproved) {
        if (audit2Approval || req?.currentStage === WorkflowStage.AUDIT_TWO) {
           steps.push({ label: 'Audit Verification (2)', stage: WorkflowStage.AUDIT_TWO, role: 'Audit' });
        } else {
           steps.push({ label: 'Audit Verification (1)', stage: WorkflowStage.AUDIT_ONE, role: 'Audit' });
        }
        steps.push({ label: 'Final Approval', stage: WorkflowStage.CHAIRMAN_FINAL, role: 'Chairman' });
      }
    } else {
      steps.push({ label: 'Store Verification', stage: WorkflowStage.STORE_CHECK, role: 'Pharmacy' });
      steps.push({ label: 'Audit Check', stage: WorkflowStage.AUDIT_ONE, role: 'Audit' });
      steps.push({ label: 'Final Approval', stage: WorkflowStage.CHAIRMAN_FINAL, role: 'Chairman' });
    }

    return steps;
  };

  const approvalChain = getApprovalChain();

  if (loading) {
    return <div className="p-12 text-center text-gray-500 flex flex-col items-center"><RefreshCcw className="animate-spin mb-2" /> Loading details...</div>;
  }

  if (!req) {
    return <div className="p-8 text-center">Requisition not found</div>;
  }

  const showPrices = isStoreCheck || isEquipmentRequest || isHistology || isPharmacyPO || !!req.parentId || req.status === RequisitionStatus.APPROVED || req.status === RequisitionStatus.FULFILLED || req.items.some(i => i.unitPrice !== undefined || i.supplier);

  const getModalActionType = () => {
    if (pendingAction === 'REJECT') return 'REJECT';
    if (pendingAction === 'RETURN') return 'RETURN';
    return 'APPROVE';
  };
  
  const getSignatureModalLabel = () => {
    if (user?.role === UserRole.AUDIT && (isEquipmentRequest || isPharmacyPO || isDailyDrugPurchase) && pendingAction === 'APPROVE') {
      return "Recommendation / Findings / Comments";
    }
    return undefined;
  };

  const renderLetterSignature = (stage: WorkflowStage, label: string) => {
    const approval = getApprovalForStage(stage);
    const active = isBoxActive(stage);
    
    return (
      <div 
        className={`border-b border-dotted border-gray-400 pb-2 mb-6 cursor-pointer hover:bg-gray-50 transition-colors relative ${active ? 'bg-orange-50' : ''}`}
        onClick={() => {
           if (active) handleApprove();
        }}
      >
        <div className="flex items-end justify-between min-h-[60px]">
           <div className="font-bold text-xs uppercase text-gray-800 w-1/3">{label}:</div>
           <div className="flex-1 flex items-center justify-center">
             {approval ? (
               <div className="flex items-center gap-4">
                 {approval.signatureType === 'STAMP' ? (
                    <div className="w-16 h-16 rounded-full border-2 border-double border-blue-800 flex flex-col items-center justify-center text-blue-900 bg-blue-50 opacity-90 rotate-[-12deg]">
                      <span className="text-[6px] font-bold uppercase">Approved</span>
                      <span className="text-[8px] font-bold text-center">{approval.department}</span>
                      <span className="text-[6px]">{formatDate(approval.timestamp)}</span>
                    </div>
                 ) : (
                    <img src={approval.signatureData} alt="Sig" className="h-12 w-auto mix-blend-multiply" />
                 )}
                 <div className="text-xs text-gray-600">
                    <p className="font-bold">{approval.approverName}</p>
                    <p className="text-[10px]">{formatDate(approval.timestamp)}</p>
                 </div>
               </div>
             ) : active ? (
                <span className="text-xs font-bold text-zankli-orange animate-pulse flex items-center gap-1">
                  <CheckCircle size={12} /> Click to Sign
                </span>
             ) : null}
           </div>
           {!approval && !active && <div className="w-1/3"></div>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>{req.parentId ? 'Back to Parent Order' : 'Back to List'}</span>
        </button>
        <div className="flex items-center gap-2">
           <button 
             onClick={handleDownloadPDF} 
             className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 border border-transparent rounded-lg hover:bg-gray-800 shadow-sm"
           >
             <Download size={16} /> Download PDF
           </button>
           <StatusBadge status={req.status} />
           <StageBadge stage={req.currentStage} />
        </div>
      </div>

      {isTurn && (
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-4 rounded-xl shadow-lg shadow-orange-900/20 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500" data-html2canvas-ignore>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-full animate-pulse">
              <PenTool size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Action Required</h3>
              <p className="text-orange-100 text-sm opacity-90">
                It is currently your turn to review and sign this request.
              </p>
            </div>
          </div>
          
          {req.status === RequisitionStatus.RETURNED && req.requesterId === user?.id ? (
             <button 
               onClick={() => navigate(`/new-request?edit=${req.id}`)}
               className="w-full sm:w-auto bg-white text-amber-700 px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-amber-50 transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-2"
             >
               <Edit3 size={16} /> Edit & Resubmit
             </button>
          ) : (
             <button 
                onClick={() => {
                    document.querySelector('#authorization-section')?.scrollIntoView({ behavior: 'smooth' });
                    if (isApprover) handleApprove();
                }}
                className="w-full sm:w-auto bg-white text-orange-700 px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-orange-50 transition-colors shadow-sm whitespace-nowrap"
            >
                {isStoreCheck ? 'Verify & Send to Audit' : 'Sign Now'}
            </button>
          )}
        </div>
      )}

      {/* Generated Child POs Link Section - HIDDEN ON PRINT */}
      {req.isParent && childIds.length > 0 && (
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm animate-in fade-in slide-in-from-top-2" data-html2canvas-ignore>
             <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2 text-lg"><Split size={20}/> Generated Purchase Orders</h3>
             <p className="text-sm text-blue-700 mb-4">This requisition has been split into multiple Professional Purchase Orders by supplier. Click below to view and download them.</p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {childIds.map(childId => {
                   const childReq = requisitions.find(r => r.id === childId);
                   const displayTitle = childReq?.title || `Purchase Order #${childId.split('-')[1] || childId}`;
                   let supplierName = "Supplier";
                   if (displayTitle.startsWith('PO: ')) {
                       const parts = displayTitle.split(' - ');
                       if (parts.length > 0) supplierName = parts[0].replace('PO: ', '');
                   }
                   
                   return (
                   <button 
                     key={childId}
                     onClick={() => navigate(`/requisitions/${childId}`)}
                     className="flex justify-between items-center w-full text-left px-4 py-3 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all text-sm font-medium text-blue-700 group cursor-pointer"
                   >
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Receipt size={18} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{supplierName}</p>
                            <p className="text-xs text-gray-500">Purchase Order #{childId.split('-').length > 1 ? childId.split('-')[1] : childId}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 text-gray-400 group-hover:text-blue-500">
                        <span className="text-xs">View</span>
                        <ArrowRight size={16} />
                     </div>
                   </button>
                   );
                })}
             </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-6" id="requisition-content">
          
          {isEmergencyDrug1Month ? (
            <div className="bg-white p-12 shadow-sm border border-gray-300 min-h-[800px] relative font-serif" id="authorization-section">
                {/* ... Emergency Drug 1 Month Form ... */}
                <div className="text-center mb-12 border-b-2 border-black pb-4">
                    <h1 className="text-2xl font-bold uppercase underline mb-2 tracking-wide">Payment Approval Form For</h1>
                    <h1 className="text-2xl font-bold uppercase underline tracking-wide">Emergency Drug</h1>
                </div>

                <div className="space-y-8 text-base font-serif">
                    <div className="flex items-baseline gap-2">
                        <span className="font-bold uppercase min-w-[100px]">DATE:</span>
                        <span className="border-b border-dotted border-gray-400 flex-1 pb-1 px-2">{formatDateTime(req.items[0].customDate || req.createdAt)}</span>
                    </div>

                    <div className="flex items-baseline gap-2">
                        <span className="font-bold uppercase min-w-[100px]">PLEASE PAY:</span>
                        <span className="border-b border-black flex-1 pb-1 px-2 font-bold uppercase">{req.items[0].payee || 'N/A'}</span>
                    </div>

                    <div className="flex items-baseline gap-2">
                        <span className="font-bold uppercase min-w-[100px]">THE SUM OF:</span>
                        <span className="border-b border-black flex-1 pb-1 px-2 font-bold">₦{req.items[0].unitPrice?.toLocaleString() || '0.00'}</span>
                    </div>

                    <div className="flex items-baseline gap-2">
                        <span className="font-bold uppercase whitespace-nowrap">(AMOUNT IN WORDS):</span>
                        <span className="border-b border-black flex-1 pb-1 px-2 uppercase text-sm">
                            {req.items[0].unitPrice ? numberToWords(req.items[0].unitPrice) : ''}
                        </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                        <span className="font-bold uppercase min-w-[100px]">BEING:</span>
                        <span className="border-b border-black flex-1 pb-1 px-2 uppercase">{req.items[0].notes || req.title}</span>
                    </div>
                </div>

                <div className="mt-16 space-y-4">
                    {renderLetterSignature(WorkflowStage.REQUESTER, "APPLICANT'S (NAME & SIGN)")}
                    {renderLetterSignature(WorkflowStage.AUDIT_TWO, "CONFIRMED BY (AUDIT 2)")}
                    {renderLetterSignature(WorkflowStage.AUDIT_ONE, "CONFIRMED BY (AUDIT 1)")}
                    {renderLetterSignature(WorkflowStage.CHAIRMAN_FINAL, "APPROVED BY (CHAIRMAN)")}
                    {renderLetterSignature(WorkflowStage.HOF_APPROVAL, "FINAL APPROVAL (FINANCE)")}
                </div>
            </div>
          ) : isEmergencyDrug1Week ? (
            <div className="bg-white p-12 shadow-sm border border-gray-300 min-h-[800px] relative font-serif" id="authorization-section">
                <div className="mb-12">
                    <h1 className="text-xl font-bold uppercase underline mb-2 tracking-wide">REQUEST FOR CASH FOR THE PURCHASE OF DRUGS</h1>
                </div>

                <div className="space-y-8 text-lg font-serif leading-relaxed">
                    <p>
                      Please, kindly approve the release of the sum of <span className="font-bold">₦{req.items[0].unitPrice?.toLocaleString() || '0.00'}</span>- <span className="uppercase">{req.items[0].unitPrice ? numberToWords(req.items[0].unitPrice) : ''}</span> for the purchase of <span className="uppercase">{req.items[0].notes || req.title}</span> .
                    </p>
                    
                    <p className="font-bold mt-8 text-center uppercase">PLEASE MA, KINDLY WRITE PLS PAY</p>

                    <div className="mt-12">
                      <p>Thank you ma,</p>
                      <br/>
                      <p className="font-bold uppercase">{req.requesterName}</p>
                    </div>
                </div>

                <div className="mt-16 space-y-4">
                    {renderLetterSignature(WorkflowStage.REQUESTER, "APPLICANT'S (NAME & SIGN)")}
                    {renderLetterSignature(WorkflowStage.AUDIT_ONE, "CONFIRMED BY (AUDIT 1)")}
                    {renderLetterSignature(WorkflowStage.CHAIRMAN_FINAL, "APPROVED BY (CHAIRMAN)")}
                </div>
            </div>
          ) : (
            <>
              <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-200">
                <div className="flex items-center gap-4 mb-8 border-b-2 border-zankli-orange pb-6">
                  <div className="w-16 h-16 bg-zankli-black text-white flex items-center justify-center font-bold text-3xl rounded-lg">Z</div>
                  <div>
                    <h1 className="text-3xl font-serif font-bold text-gray-900">
                        {req.parentId ? 'Purchase Order' : 'Zankli Medical Centre'}
                    </h1>
                    <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">
                        {req.parentId ? 'Official Purchase Order' : 'Official Requisition Document'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{req.title}</h1>
                    <p className="text-sm text-gray-500">Department: {req.department}</p>
                    {req.parentId && <p className="text-xs text-blue-600 mt-1">Split PO (Parent ID: {req.parentId.split('-')[1]})</p>}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono text-gray-400">#{req.id.split('-')[1] || req.id}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
                    <Tag size={14} />
                    <span>{req.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
                    <AlertCircle size={14} />
                    <UrgencyBadge level={req.urgency} />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
                    <Clock size={14} />
                    <span>{formatDate(req.createdAt)}</span>
                  </div>
                </div>
                
                {req.rejectionReason && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg">
                    <h4 className="text-sm font-bold text-red-800 mb-1 flex items-center gap-2">
                      <AlertCircle size={14} /> Return/Rejection Note:
                    </h4>
                    <p className="text-sm text-red-700 italic">"{req.rejectionReason}"</p>
                  </div>
                )}
                
                {(isEquipmentRequest || isPharmacyPO || isDailyDrugPurchase) && auditRecommendation && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <h4 className="text-sm font-bold text-blue-800 mb-1 flex items-center gap-2">
                      <FileCheck size={16} /> Audit Findings / Recommendation:
                    </h4>
                    <p className="text-sm text-blue-800 italic">"{auditRecommendation.comment}"</p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">- {auditRecommendation.approverName}</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <h2 className="font-semibold text-gray-900">{isHistology ? 'Payment Details' : 'Requisition Items'}</h2>
                  {isStoreCheck && (
                    <span className="text-xs font-medium text-zankli-orange bg-orange-50 px-2 py-1 rounded border border-orange-100" data-html2canvas-ignore>
                      Store Mode: Edit Enabled
                    </span>
                  )}
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      {isHistology ? (
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hosp/Lab No</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pmt Ref</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                          <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outsource Bill</th>
                          <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">ZMC Chg</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retain</th>
                        </tr>
                      ) : (
                        <tr>
                          {isDailyDrugPurchase && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">S/N</th>}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Description</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                          {!(isEquipmentRequest || isPharmacyPO) && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock Level</th>}
                          {showPrices && (
                            <>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Supplier</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Price</th>
                              {isStoreCheck && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase" data-html2canvas-ignore>Avail.</th>}
                            </>
                          )}
                        </tr>
                      )}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {req.items.map((item, index) => (
                        <tr key={item.id} className={!item.isAvailable ? 'bg-gray-50 opacity-60' : ''}>
                          {isHistology ? (
                             <>
                               <td className="px-3 py-4 text-xs text-gray-900 whitespace-nowrap">{item.customDate || '-'}</td>
                               <td className="px-3 py-4 text-xs font-medium text-gray-900">{item.patientName || '-'}</td>
                               <td className="px-3 py-4 text-xs text-gray-500">
                                 <div>{item.hospitalNumber || '-'}</div>
                                 <div className="text-[10px]">{item.labNumber || '-'}</div>
                               </td>
                               <td className="px-3 py-4 text-xs text-gray-500">{item.paymentReference || '-'}</td>
                               <td className="px-3 py-4 text-xs text-gray-900">{item.name}</td>
                               <td className="px-3 py-4 text-xs text-right font-medium text-gray-900">₦{item.unitPrice?.toLocaleString() || '-'}</td>
                               <td className="px-3 py-4 text-xs text-right text-gray-500">{item.zmcPrice ? `₦${item.zmcPrice.toLocaleString()}` : '-'}</td>
                               <td className="px-3 py-4 text-xs text-gray-500">{item.retainership || '-'}</td>
                             </>
                          ) : (
                             <>
                              {isDailyDrugPurchase && <td className="px-4 py-4 text-sm text-center text-gray-500">{index + 1}</td>}
                              <td className="px-4 py-4 text-sm text-gray-900">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-gray-500">{item.unit}</div>
                              </td>
                              <td className="px-4 py-4 text-sm text-center text-gray-900">{item.quantity}</td>
                              {!(isEquipmentRequest || isPharmacyPO) && <td className="px-4 py-4 text-sm text-center text-gray-500">{item.stockLevel}</td>}
                              
                              {showPrices && (
                                <>
                                  <td className="px-4 py-2">
                                    {isStoreCheck ? (
                                      <input 
                                        type="text" 
                                        disabled={!item.isAvailable}
                                        value={item.supplier || ''}
                                        onChange={(e) => handleLocalUpdate(item.id, 'supplier', e.target.value)}
                                        onBlur={handlePersistUpdate}
                                        placeholder="Supplier Name"
                                        className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-zankli-orange focus:ring-zankli-orange disabled:bg-gray-100"
                                        data-html2canvas-ignore
                                      />
                                    ) : null}
                                    <span className={isStoreCheck ? "hidden" : "text-sm"}>{item.supplier || '-'}</span>
                                    {isStoreCheck && <span className="hidden print-block text-sm">{item.supplier || '-'}</span>}
                                  </td>
                                  <td className="px-4 py-2">
                                    {isStoreCheck ? (
                                        <div className="relative" data-html2canvas-ignore>
                                          <span className="absolute left-2 top-1.5 text-gray-400 text-xs">₦</span>
                                          <input 
                                            type="number" 
                                            disabled={!item.isAvailable}
                                            value={item.unitPrice || ''}
                                            onChange={(e) => handleLocalUpdate(item.id, 'unitPrice', parseFloat(e.target.value))}
                                            onBlur={handlePersistUpdate}
                                            className="w-full pl-5 text-sm border-gray-300 rounded-md shadow-sm focus:border-zankli-orange focus:ring-zankli-orange disabled:bg-gray-100"
                                          />
                                        </div>
                                    ) : null}
                                    <span className={isStoreCheck ? "hidden" : "text-sm"}>₦{item.unitPrice?.toLocaleString() || '-'}</span>
                                    {isStoreCheck && <span className="hidden print-block text-sm">₦{item.unitPrice?.toLocaleString() || '-'}</span>}
                                  </td>
                                  {isStoreCheck && (
                                    <td className="px-4 py-2 text-center" data-html2canvas-ignore>
                                      <input 
                                        type="checkbox"
                                        checked={item.isAvailable ?? true}
                                        onChange={(e) => {
                                            handleLocalUpdate(item.id, 'isAvailable', e.target.checked);
                                            // For checkbox we persist immediately as there's no blur event flow like text inputs
                                            const updatedItems = localReq!.items.map(i => i.id === item.id ? { ...i, isAvailable: e.target.checked } : i);
                                            updateRequisition({ ...localReq!, items: updatedItems });
                                        }}
                                        className="h-4 w-4 text-zankli-orange focus:ring-zankli-orange border-gray-300 rounded"
                                      />
                                    </td>
                                  )}
                                </>
                              )}
                             </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {showPrices && (
                      <tfoot>
                        <tr className="bg-gray-100 border-t-2 border-gray-300">
                          <td colSpan={isHistology ? 5 : ((isEquipmentRequest || isPharmacyPO) ? 3 : 4)} className="px-4 py-4 text-right text-sm font-bold text-gray-900 uppercase tracking-wide">
                            Total {isHistology ? 'Bill' : 'Cost'}
                          </td>
                          <td className={`px-4 py-4 ${isHistology ? 'text-right' : 'text-left'}`}>
                            <span className="text-lg font-bold text-zankli-orange">
                              ₦{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          {isHistology && <td colSpan={2}></td>}
                          {isStoreCheck && <td data-html2canvas-ignore></td>}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {isStoreCheck && (
                  <div className="p-4 bg-orange-50 border-t border-orange-100 text-xs text-orange-800 flex gap-2" data-html2canvas-ignore>
                    <AlertCircle size={14} className="mt-0.5" />
                    <p>Uncheck "Avail." for items out of stock. Add suppliers and prices for Audit review. Changes are saved automatically when you leave a field.</p>
                  </div>
                )}
              </div>

              <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-200 break-inside-avoid" id="authorization-section">
                 <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-200 pb-2">Authorization Chain</h3>
                 
                 <div className="flex flex-wrap -mx-3">
                    {approvalChain.map((step, index) => {
                      const approval = getApprovalForStage(step.stage);
                      const active = isBoxActive(step.stage);
                      
                      return (
                        <div key={step.stage} className="w-1/2 lg:w-1/3 px-3 mb-6">
                          <div 
                            className={`
                              relative flex flex-col p-4 border rounded-lg h-[180px]
                              ${approval ? 'bg-white border-black' : 'bg-gray-50 border-gray-200 border-dashed'}
                              ${active ? 'ring-2 ring-zankli-orange cursor-pointer hover:bg-orange-50' : ''}
                            `}
                            onClick={() => {
                              if (!active) return;
                              if (step.stage === WorkflowStage.CHAIRMAN_INITIAL && (isEquipmentRequest || isDailyDrugPurchase)) return;
                              handleApprove();
                            }}
                          >
                            <span className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2 block">{step.label}</span>
                            
                            {approval ? (
                              <div className="flex flex-col items-center justify-center h-full">
                                {approval.signatureType === 'STAMP' ? (
                                  <div className="w-20 h-20 rounded-full border-4 border-double border-blue-800 flex flex-col items-center justify-center text-blue-900 bg-blue-50 opacity-90 rotate-[-12deg]">
                                    <span className="text-[8px] font-bold uppercase tracking-wider">Approved</span>
                                    <span className="text-[10px] font-bold leading-tight text-center px-1">{approval.department}</span>
                                    <span className="text-[6px] mt-0.5">{formatDate(approval.timestamp)}</span>
                                  </div>
                                ) : (
                                  <img src={approval.signatureData} alt="Sig" className="h-16 w-auto mix-blend-multiply" />
                                )}
                                <div className="mt-2 text-center">
                                  <p className="text-xs font-bold text-gray-900">{approval.approverName}</p>
                                  <p className="text-[10px] text-gray-500">{formatDateTime(approval.timestamp)}</p>
                                </div>
                                {approval.comment && (
                                    <p className="text-[9px] text-gray-500 italic mt-1 text-center w-full truncate px-1" title={approval.comment}>
                                        "{approval.comment}"
                                    </p>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                {active ? (
                                  <div className="flex flex-col items-center text-zankli-orange animate-pulse" data-html2canvas-ignore>
                                    <CheckCircle size={24} className="mb-1" />
                                    <span className="text-xs font-bold">
                                      {step.stage === WorkflowStage.CHAIRMAN_INITIAL && (isEquipmentRequest || isDailyDrugPurchase) ? 'Pending Action' : 'Click to Sign'}
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <Clock size={24} className="mb-1 opacity-50" />
                                    <span className="text-xs">Pending</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                 </div>
              </div>
            </>
          )}

          <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Download size={20} /> Attachments & Documents
            </h3>
            
            {req.attachments && req.attachments.length > 0 ? (
              <div className="space-y-6">
                {req.attachments.map((file, idx) => (
                  <FilePreview key={idx} url={file.url} name={file.name} type={file.type} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic mb-4">No documents attached.</p>
            )}

            {(isStoreCheck || req.status === RequisitionStatus.DRAFT || req.status === RequisitionStatus.PENDING) && (
              <div className="flex items-center justify-center w-full mt-4" data-html2canvas-ignore>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload quote</span> or drag and drop</p>
                    <p className="text-xs text-gray-500">PDF, PNG, JPG (MAX. 5MB)</p>
                  </div>
                  <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.png,.jpg" />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6" data-html2canvas-ignore>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Requester Info</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">
                {req.requesterName.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-900">{req.requesterName}</p>
                <p className="text-sm text-gray-500">{req.department}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Submitted:</span>
                <span className="text-gray-900">{formatDate(req.createdAt)}</span>
              </div>
              {req.parentId && (
                 <div className="flex justify-between">
                  <span className="text-gray-500">Parent Req ID:</span>
                  <span className="text-blue-600 font-mono">#{req.parentId.split('-')[1]}</span>
                </div>
              )}
            </div>
          </div>

          {isStoreCheck && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-zankli-orange ring-1 ring-zankli-orange/20">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Store Actions</h3>
              <p className="text-sm text-gray-500 mb-6">Review availability and add pricing. Click Verify to send to Audit.</p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => handleApprove()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zankli-orange text-white rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-md shadow-orange-900/10"
                >
                  <CheckCircle size={18} />
                  Verify & Send to Audit
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleReject}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                  <button 
                    onClick={handleReturn}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    <RefreshCcw size={16} />
                    Return
                  </button>
                </div>
              </div>
            </div>
          )}

          {isApprover && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
               <h3 className="text-lg font-bold text-gray-900 mb-2">Approval Actions</h3>
               <p className="text-sm text-gray-500 mb-6">Review the details above and provide your digital signature.</p>
               
               <div className="space-y-3">
                 {isChairmanCheck && (isEquipmentRequest || isDailyDrugPurchase) ? (
                   <>
                    <button 
                      onClick={handleDirectApprove}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md shadow-green-900/10"
                    >
                      <CheckCircle size={18} />
                      Approve Directly
                    </button>
                    <button 
                      onClick={() => handleApprove(WorkflowStage.AUDIT_ONE)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
                    >
                      <GitBranch size={18} />
                      Verify via Audit 1
                    </button>
                    <button 
                      onClick={() => handleApprove(WorkflowStage.AUDIT_TWO)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md"
                    >
                      <GitBranch size={18} />
                      Verify via Audit 2
                    </button>
                   </>
                 ) : (
                   <button 
                      onClick={() => handleApprove()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md shadow-green-900/10"
                   >
                     <CheckCircle size={18} />
                     {isStoreCheck ? 'Verify & Send to Audit' : 'Approve Request'}
                   </button>
                 )}
                 
                 <div className="grid grid-cols-2 gap-3">
                   <button 
                      onClick={handleReject}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                   >
                     <XCircle size={16} />
                     Reject
                   </button>
                   <button 
                      onClick={handleReturn}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                   >
                     <RefreshCcw size={16} />
                     Return
                   </button>
                 </div>
               </div>
            </div>
          )}

           {isAccountView && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Receipt size={18} /> Payment Management
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">Record payments for this completed requisition.</p>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-6 grid grid-cols-2 gap-4">
                      <div>
                          <p className="text-xs text-gray-500 uppercase">Total Amount</p>
                          <p className="text-lg font-bold text-gray-900">₦{grandTotal.toLocaleString()}</p>
                      </div>
                       <div>
                          <p className="text-xs text-gray-500 uppercase">Total Paid</p>
                          <p className="text-lg font-bold text-green-600">₦{totalPaid.toLocaleString()}</p>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                              <p className="text-xs text-gray-500 uppercase font-bold">Outstanding</p>
                              <p className={`font-bold ${grandTotal - totalPaid > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                  ₦{(grandTotal - totalPaid).toLocaleString()}
                              </p>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, (totalPaid / grandTotal) * 100)}%` }}
                              ></div>
                          </div>
                      </div>
                  </div>

                  {showPaymentForm ? (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
                          <div className="space-y-3">
                              <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">Amount (₦)</label>
                                  <input 
                                    type="number" 
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                                    className="w-full border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Enter amount..."
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">Notes</label>
                                  <input 
                                    type="text" 
                                    value={paymentNote}
                                    onChange={(e) => setPaymentNote(e.target.value)}
                                    className="w-full border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Check number, transfer ref..."
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">Evidence (Optional)</label>
                                  <input 
                                    type="file" 
                                    onChange={handlePaymentFileUpload}
                                    className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-white file:text-blue-600 hover:file:bg-blue-50"
                                  />
                              </div>
                              <div className="flex gap-2 pt-2">
                                  <button onClick={() => setShowPaymentForm(false)} className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded hover:bg-gray-50">Cancel</button>
                                  <button onClick={handleAddPayment} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700">Save Payment</button>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <button 
                        onClick={() => setShowPaymentForm(true)}
                        disabled={grandTotal - totalPaid <= 0}
                        className={`w-full py-2 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 text-sm font-bold transition-colors ${grandTotal - totalPaid <= 0 ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-300 text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'}`}
                      >
                          <Plus size={16} /> Add Payment
                      </button>
                  )}

                  {req.payments && req.payments.length > 0 && (
                      <div className="mt-6">
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Payment History</h4>
                          <div className="space-y-3">
                              {req.payments.map((p) => (
                                  <div key={p.id} className="flex justify-between items-start text-sm border-b border-gray-100 pb-2">
                                      <div>
                                          <p className="font-bold text-gray-900">₦{p.amount.toLocaleString()}</p>
                                          <p className="text-xs text-gray-500">{formatDate(p.date)} by {p.recordedBy}</p>
                                          {p.notes && <p className="text-xs text-gray-600 italic mt-0.5">{p.notes}</p>}
                                      </div>
                                      {p.evidenceUrl && (
                                          <a href={p.evidenceUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline flex items-center gap-1">
                                              View Proof <Download size={10} />
                                          </a>
                                      )}
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
           )}

        </div>
      </div>

      {showSignatureModal && user && (
        <SignatureModal 
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onConfirm={handleSignatureConfirm}
          user={user}
          actionType={getModalActionType()}
          commentLabel={getSignatureModalLabel()}
        />
      )}
    </div>
  );
};

export default RequisitionDetail;
