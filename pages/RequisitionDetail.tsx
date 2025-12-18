
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserRole, WorkflowStage, RequisitionItem, Approval, Requisition, RequisitionStatus, RequisitionType, Payment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useRequisition } from '../contexts/RequisitionContext';
import { StatusBadge, UrgencyBadge, StageBadge } from '../components/StatusBadge';
import { ArrowLeft, Upload, CheckCircle, XCircle, AlertCircle, ShoppingBag, Truck, Tag, DollarSign, Split, Printer, Download, Clock, RefreshCcw, PenTool, GitBranch, FileCheck, Plus, Receipt, Edit3, ExternalLink, ArrowRight, BellRing, Zap } from 'lucide-react';
import SignatureModal from '../components/SignatureModal';
import FilePreview from '../components/FilePreview';
import { formatDateTime, formatDate, numberToWords, fileToBase64, isUserTurn } from '../utils';
import { supabase } from '../lib/supabase';

// Declarations for html2pdf
declare var html2pdf: any;

const RequisitionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requisitions, updateRequisition, addRequisition, refresh } = useRequisition();
  
  const [localReq, setLocalReq] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchFullDetails = async () => {
      if (!id) return;
      const contextReq = requisitions.find(r => r.id === id);
      if (contextReq) {
        if (isMounted) {
            setLocalReq(contextReq);
            if (contextReq.items && contextReq.items.length > 0) {
                setLoading(false);
            } else {
                setLoading(true);
            }
        }
      }
      try {
        const { data, error } = await supabase.from('requisitions').select('*').eq('id', id).single();
        if (isMounted && data && !error) {
           const fullData: Requisition = {
             id: data.id, requesterId: data.requester_id, requesterName: data.requester_name,
             department: data.department, type: data.type, title: data.title,
             createdAt: data.created_at, updatedAt: data.updated_at, status: data.status,
             currentStage: data.current_stage, urgency: data.urgency, items: data.items || [],
             attachments: data.attachments || [], approvals: data.approvals || [],
             payments: data.payments || [], rejectionReason: data.rejection_reason,
             parentId: data.parent_id, isParent: data.is_parent,
             childRequisitionIds: data.child_requisition_ids,
             lastRemindedAt: data.last_reminded_at, reminderCount: data.reminder_count
           };
           setLocalReq(fullData);
           setLoading(false);
        } else if (isMounted) {
           setLoading(false);
        }
      } catch (err) {
        if (isMounted) setLoading(false);
      }
    };
    fetchFullDetails();
    return () => { isMounted = false; };
  }, [id, requisitions]); 
  
  const req = localReq;
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'APPROVE' | 'REJECT' | 'RETURN' | null>(null);
  const [isReminding, setIsReminding] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [nextAuditStage, setNextAuditStage] = useState<WorkflowStage.AUDIT_ONE | WorkflowStage.AUDIT_TWO | null>(null);
  const [isDirectApproval, setIsDirectApproval] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentFile, setPaymentFile] = useState<{name: string, url: string} | null>(null);

  const isEmergencyDrug1Month = req?.type === RequisitionType.EMERGENCY_DRUG_PURCHASE_1_MONTH;
  const isEmergencyDrug1Week = req?.type === RequisitionType.EMERGENCY_DRUG_PURCHASE_1_WEEK;
  const isHistology = req?.type === RequisitionType.OUTSOURCED_HISTOLOGY_PAYMENT;
  const isPharmacyPO = req?.type === RequisitionType.PHARMACY_PURCHASE_ORDER;
  const isEquipmentRequest = req?.type === RequisitionType.EQUIPMENT_REQUEST;
  const isDailyDrugPurchase = req?.type === RequisitionType.DAILY_DRUG_PURCHASE;
  const isLabPO = req?.type === RequisitionType.LAB_PURCHASE_ORDER;

  const isStoreCheck = user?.role === UserRole.PHARMACY && req?.currentStage === WorkflowStage.STORE_CHECK;
  const isChairmanCheck = user?.role === UserRole.CHAIRMAN && req?.currentStage === WorkflowStage.CHAIRMAN_INITIAL;
  
  const isApprover = !isStoreCheck && (
    (user?.role === UserRole.CHAIRMAN && (req?.currentStage === WorkflowStage.CHAIRMAN_INITIAL || req?.currentStage === WorkflowStage.CHAIRMAN_FINAL)) ||
    (user?.role === UserRole.AUDIT && (req?.currentStage === WorkflowStage.AUDIT_ONE || req?.currentStage === WorkflowStage.AUDIT_TWO)) ||
    (user?.role === UserRole.FINANCE && req?.currentStage === WorkflowStage.HOF_APPROVAL)
  );
  
  const isAccountView = user?.role === UserRole.ACCOUNTS && (req?.status === RequisitionStatus.APPROVED || req?.status === RequisitionStatus.FULFILLED);

  const isTurn = useMemo(() => {
    if (!req || !user) return false;
    return isUserTurn(req, user);
  }, [req, user]);

  const grandTotal = useMemo(() => {
    if (!req) return 0;
    return req.items.reduce((sum, item) => item.isAvailable !== false ? sum + ((item.unitPrice || 0) * item.quantity) : sum, 0);
  }, [req]);
  
  const totalPaid = useMemo(() => req?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0, [req?.payments]);

  const handleBack = () => req?.parentId ? navigate(`/requisitions/${req.parentId}`) : navigate('/requisitions');

  // REMINDER LOGIC
  const canSendReminder = useMemo(() => {
    if (!user || !req) return false;
    const isPendingOthers = req.status === RequisitionStatus.PENDING && !isTurn;
    return (req.requesterId === user.id || user.email === 'storezankli@gmail.com' || user.email === 'labzankli@gmail.com') && isPendingOthers;
  }, [user, req, isTurn]);

  const handleSendReminder = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent any parent click handlers
    if (!req || isReminding) return;

    setIsReminding(true);
    try {
        const newCount = (req.reminderCount || 0) + 1;
        const now = new Date().toISOString();
        
        // Use direct Supabase call for speed (partial update to avoid lag with attachments)
        const { error } = await supabase
            .from('requisitions')
            .update({
                last_reminded_at: now,
                reminder_count: newCount,
                updated_at: now
            })
            .eq('id', req.id);

        if (error) throw error;
        
        // Update local context manually to show success instantly
        await refresh(); 
        setReminderSent(true);
        setTimeout(() => setReminderSent(false), 3000); // Reset button after 3s
    } catch (e: any) {
        console.error("Reminder failed:", e);
        alert("Failed to send reminder. Ensure columns last_reminded_at and reminder_count exist in DB.");
    } finally {
        setIsReminding(false);
    }
  };

  const handleLocalUpdate = (itemId: string, field: keyof RequisitionItem, value: any) => {
    if (!localReq) return;
    const updatedItems = localReq.items.map(item => item.id === itemId ? { ...item, [field]: value } : item);
    setLocalReq({ ...localReq, items: updatedItems });
  };

  const handlePersistUpdate = async () => localReq && await updateRequisition(localReq);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && req) {
      const file = e.target.files[0];
      try {
        const base64 = await fileToBase64(file);
        const updatedReq = { ...req, attachments: [...(req.attachments || []), { name: file.name, url: base64, type: file.type }] };
        setLocalReq(updatedReq);
        updateRequisition(updatedReq);
      } catch (error) { alert("Upload failed"); }
    }
  };

  const handleApprove = (destination?: WorkflowStage.AUDIT_ONE | WorkflowStage.AUDIT_TWO) => {
    setIsDirectApproval(false);
    setNextAuditStage(destination || null);
    setPendingAction('APPROVE');
    setShowSignatureModal(true);
  }

  const handleReject = () => { setPendingAction('REJECT'); setShowSignatureModal(true); }
  const handleReturn = () => { setPendingAction('RETURN'); setShowSignatureModal(true); };

  const handleDownloadPDF = () => {
    const element = document.getElementById('requisition-content');
    if (!element || !req) return;
    const opt = { margin: 10, filename: `Req_${req.id.split('-')[1] || req.id}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save();
  };

  const handleSignatureConfirm = async (type: 'DRAWN' | 'STAMP', data: string, comment?: string) => {
    if (!req || !user) return;
    const newApproval: Approval = { id: `app_${Date.now()}`, approverId: user.id, approverName: user.name, role: user.role, department: user.department, stage: req.currentStage || WorkflowStage.CHAIRMAN_INITIAL, timestamp: new Date().toISOString(), signatureType: type, signatureData: data, comment: comment };
    
    // Reset reminderCount to 0 to dismiss the emergency bar for the next approver
    let updatedReq: Requisition = { ...req, approvals: [...(req.approvals || []), newApproval], reminderCount: 0 }; 

    if (pendingAction === 'REJECT') {
      updatedReq.status = RequisitionStatus.REJECTED;
      updatedReq.currentStage = WorkflowStage.COMPLETED;
    } else if (pendingAction === 'RETURN') {
      updatedReq.status = RequisitionStatus.RETURNED;
      updatedReq.currentStage = WorkflowStage.DRAFT_EDIT;
      updatedReq.rejectionReason = comment;
    } else {
      let nextStage = req.currentStage;
      if (isEmergencyDrug1Month) {
        if (req.currentStage === WorkflowStage.AUDIT_TWO) nextStage = WorkflowStage.AUDIT_ONE;
        else if (req.currentStage === WorkflowStage.AUDIT_ONE) nextStage = WorkflowStage.CHAIRMAN_FINAL;
        else if (req.currentStage === WorkflowStage.CHAIRMAN_FINAL) nextStage = WorkflowStage.HOF_APPROVAL;
        else nextStage = WorkflowStage.COMPLETED;
      } else if (isEmergencyDrug1Week || isHistology || isPharmacyPO) {
        if (req.currentStage === WorkflowStage.AUDIT_ONE) nextStage = WorkflowStage.CHAIRMAN_FINAL;
        else if (req.currentStage === WorkflowStage.CHAIRMAN_FINAL) nextStage = WorkflowStage.COMPLETED;
        else nextStage = WorkflowStage.AUDIT_ONE;
      } else if (isEquipmentRequest || isDailyDrugPurchase) {
        if (req.currentStage === WorkflowStage.CHAIRMAN_INITIAL) nextStage = isDirectApproval ? WorkflowStage.COMPLETED : (nextAuditStage || WorkflowStage.AUDIT_ONE);
        else if (req.currentStage === WorkflowStage.AUDIT_ONE || req.currentStage === WorkflowStage.AUDIT_TWO) nextStage = WorkflowStage.CHAIRMAN_FINAL;
        else nextStage = WorkflowStage.COMPLETED;
      } else {
        if (req.currentStage === WorkflowStage.CHAIRMAN_INITIAL) nextStage = WorkflowStage.STORE_CHECK;
        else if (req.currentStage === WorkflowStage.STORE_CHECK) nextStage = WorkflowStage.AUDIT_ONE;
        else if (req.currentStage === WorkflowStage.AUDIT_ONE) nextStage = WorkflowStage.CHAIRMAN_FINAL;
        else nextStage = WorkflowStage.COMPLETED;
      }
      updatedReq.currentStage = nextStage;
      if (nextStage === WorkflowStage.COMPLETED) updatedReq.status = RequisitionStatus.APPROVED;
    }

    setLocalReq(updatedReq);
    await updateRequisition(updatedReq);
    setShowSignatureModal(false);
    navigate('/requisitions');
  };

  const renderLetterSignature = (stage: WorkflowStage, label: string) => {
    const approval = req?.approvals?.find(a => a.stage === stage);
    const active = isBoxActive(stage);
    return (
      <div className={`border-b border-dotted border-gray-400 pb-2 mb-6 cursor-pointer relative ${active ? 'bg-orange-50' : ''}`} onClick={() => active && handleApprove()}>
        <div className="flex items-end justify-between min-h-[60px]">
           <div className="font-bold text-xs uppercase text-gray-800 w-1/3">{label}:</div>
           <div className="flex-1 flex items-center justify-center">
             {approval ? (
               <div className="flex items-center gap-4">
                 {approval.signatureType === 'STAMP' ? <div className="w-16 h-16 rounded-full border-2 border-double border-blue-800 flex items-center justify-center text-blue-900 bg-blue-50 rotate-[-12deg] text-[8px] font-bold">Approved</div> : <img src={approval.signatureData} alt="Sig" className="h-12 w-auto mix-blend-multiply" />}
                 <div className="text-xs text-gray-600"><p className="font-bold">{approval.approverName}</p><p className="text-[10px]">{formatDate(approval.timestamp)}</p></div>
               </div>
             ) : active ? <span className="text-xs font-bold text-zankli-orange animate-pulse">Click to Sign</span> : null}
           </div>
           {!approval && !active && <div className="w-1/3"></div>}
        </div>
      </div>
    );
  };

  const isBoxActive = (stage: WorkflowStage) => user && req?.currentStage === stage && ((stage === WorkflowStage.CHAIRMAN_INITIAL && user.role === UserRole.CHAIRMAN) || (stage === WorkflowStage.STORE_CHECK && user.role === UserRole.PHARMACY) || (stage === WorkflowStage.AUDIT_ONE && user.role === UserRole.AUDIT) || (stage === WorkflowStage.AUDIT_TWO && user.role === UserRole.AUDIT) || (stage === WorkflowStage.CHAIRMAN_FINAL && user.role === UserRole.CHAIRMAN) || (stage === WorkflowStage.HOF_APPROVAL && user.role === UserRole.FINANCE));

  if (loading) return <div className="p-12 text-center text-gray-500"><RefreshCcw className="animate-spin mb-2" /> Loading...</div>;
  if (!req) return <div className="p-8 text-center">Not found</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button onClick={handleBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900"><ArrowLeft size={20} /> Back</button>
        <div className="flex items-center gap-2">
           <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gray-900 rounded-lg"><Download size={16} /> PDF</button>
           <StatusBadge status={req.status} /><StageBadge stage={req.currentStage} />
        </div>
      </div>

      {isTurn && (
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-4 rounded-xl shadow-lg flex items-center justify-between gap-4" data-html2canvas-ignore>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-full animate-pulse"><PenTool size={24} /></div>
            <div><h3 className="font-bold text-lg">Action Required</h3><p className="text-orange-100 text-sm">Please review and sign.</p></div>
          </div>
          <button onClick={() => document.querySelector('#authorization-section')?.scrollIntoView({ behavior: 'smooth' })} className="bg-white text-orange-700 px-6 py-2 rounded-lg font-bold text-sm">Sign Now</button>
        </div>
      )}

      {canSendReminder && (
         <div className="bg-red-50 border border-red-200 text-red-900 px-6 py-4 rounded-xl flex items-center justify-between gap-4" data-html2canvas-ignore>
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-full text-red-600"><BellRing size={20} /></div>
                <div><h3 className="font-bold">Awaiting Approval</h3><p className="text-sm text-red-700">Currently with <strong>{req.currentStage}</strong>.</p></div>
            </div>
            <button 
                onClick={handleSendReminder}
                disabled={isReminding || reminderSent}
                className={`px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all transform active:scale-95 shadow-md ${reminderSent ? 'bg-green-600 text-white' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
                {isReminding ? (
                    <RefreshCcw size={14} className="animate-spin" />
                ) : reminderSent ? (
                    <CheckCircle size={16} />
                ) : (
                    <Zap size={16} fill="currentColor" />
                )}
                {reminderSent ? 'Reminder Sent!' : 'Send Urgent Reminder'}
            </button>
         </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6" id="requisition-content">
          {isEmergencyDrug1Month || isEmergencyDrug1Week ? (
            <div className="bg-white p-12 shadow-sm border border-gray-300 min-h-[800px] font-serif" id="authorization-section">
                <div className="text-center mb-12 border-b-2 border-black pb-4"><h1 className="text-2xl font-bold uppercase underline">Emergency Drug Approval</h1></div>
                <div className="space-y-8">
                    <div className="flex gap-2"><strong>DATE:</strong> <span className="border-b border-dotted flex-1">{formatDate(req.createdAt)}</span></div>
                    <div className="flex gap-2"><strong>PLEASE PAY:</strong> <span className="border-b border-black flex-1 font-bold">{req.items[0].payee || req.requesterName}</span></div>
                    <div className="flex gap-2"><strong>THE SUM OF:</strong> <span className="border-b border-black flex-1 font-bold">₦{req.items[0].unitPrice?.toLocaleString()}</span></div>
                    <div className="flex gap-2"><strong>BEING:</strong> <span className="border-b border-black flex-1">{req.items[0].notes || req.title}</span></div>
                </div>
                <div className="mt-16 space-y-4">
                    {renderLetterSignature(WorkflowStage.REQUESTER, "APPLICANT")}
                    {renderLetterSignature(WorkflowStage.AUDIT_ONE, "AUDIT 1")}
                    {renderLetterSignature(WorkflowStage.CHAIRMAN_FINAL, "CHAIRMAN")}
                </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-200">
                <div className="flex items-center gap-4 mb-8 border-b-2 border-zankli-orange pb-6">
                  <div className="w-12 h-12 bg-zankli-black text-white flex items-center justify-center font-bold text-xl rounded">Z</div>
                  <h1 className="text-2xl font-bold">Zankli Medical Centre</h1>
                </div>
                <h2 className="text-xl font-bold mb-4">{req.title}</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr><th className="px-4 py-2 text-left text-xs font-bold uppercase">Item</th><th className="px-4 py-2 text-center text-xs font-bold uppercase">Qty</th><th className="px-4 py-2 text-right text-xs font-bold uppercase">Price</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {req.items.map(item => (
                        <tr key={item.id}><td className="px-4 py-3 text-sm">{item.name}</td><td className="px-4 py-3 text-center text-sm">{item.quantity}</td><td className="px-4 py-3 text-right text-sm">₦{item.unitPrice?.toLocaleString() || '-'}</td></tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                      <tr><td colSpan={2} className="px-4 py-3 text-right">TOTAL</td><td className="px-4 py-3 text-right text-zankli-orange text-lg">₦{grandTotal.toLocaleString()}</td></tr>
                    </tfoot>
                  </table>
                </div>
                <div className="mt-8 border-t pt-8" id="authorization-section">
                   <h3 className="font-bold mb-4">Authorizations</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {req.approvals.map(a => (
                        <div key={a.id} className="p-3 border rounded-lg bg-gray-50 flex items-center gap-3">
                           <div className="w-12 h-12 rounded-full border-2 border-blue-800 flex items-center justify-center text-blue-900 rotate-[-12deg] text-[6px] font-bold">STAMP</div>
                           <div className="text-xs"><strong>{a.approverName}</strong><p className="text-gray-500">{a.stage}</p></div>
                        </div>
                     ))}
                   </div>
                </div>
            </div>
          )}
        </div>
        <div className="space-y-6" data-html2canvas-ignore>
           {isApprover && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-zankli-orange">
               <h3 className="text-lg font-bold mb-4">Action Panel</h3>
               <div className="space-y-3">
                 <button onClick={() => handleApprove()} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold">Approve</button>
                 <button onClick={handleReject} className="w-full py-2 bg-white border border-gray-300 text-red-600 rounded-lg text-sm">Reject</button>
                 <button onClick={handleReturn} className="w-full py-2 bg-white border border-gray-300 text-amber-600 rounded-lg text-sm">Return</button>
               </div>
            </div>
           )}
        </div>
      </div>
      {showSignatureModal && user && <SignatureModal isOpen={showSignatureModal} onClose={() => setShowSignatureModal(false)} onConfirm={handleSignatureConfirm} user={user} />}
    </div>
  );
};

export default RequisitionDetail;
