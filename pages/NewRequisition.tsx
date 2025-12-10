
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Send, CheckCircle2, ClipboardList, Zap, Microscope, Pill, CalendarClock, ArrowLeft, Upload, X, Clock, Sparkles } from 'lucide-react';
import { UrgencyLevel, RequisitionType, UserRole, WorkflowStage, Approval, RequisitionStatus, Requisition } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRequisition } from '../contexts/RequisitionContext';
import SignatureModal from '../components/SignatureModal';
import { numberToWords, fileToBase64 } from '../utils';
import { supabase } from '../lib/supabase';

// Declare XLSX for client-side parsing
declare var XLSX: any;

const NewRequisition: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const { user } = useAuth();
  const { addRequisition, updateRequisition } = useRequisition();
  
  const [items, setItems] = useState<any[]>([{ id: Date.now(), name: '', quantity: 1, stockLevel: 0, unit: 'pcs', notes: '', unitPrice: '', supplier: '', payee: '' }]);
  const [urgency, setUrgency] = useState<UrgencyLevel>(UrgencyLevel.NORMAL);
  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState<RequisitionType | null>(null);
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: string }[]>([]);
  
  // Signature State
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load data if editing
  useEffect(() => {
    const loadEditData = async () => {
      if (editId) {
        setIsLoading(true);
        try {
          // Fetch full data directly from DB to ensure attachments are present
          const { data, error } = await supabase
            .from('requisitions')
            .select('*')
            .eq('id', editId)
            .single();

          if (data && !error) {
            const reqToEdit = data;
             // Ensure user is allowed to edit (Draft or Returned)
            if (reqToEdit.status !== RequisitionStatus.RETURNED && reqToEdit.status !== RequisitionStatus.DRAFT) {
               // navigate('/requisitions');
            }
            setTitle(reqToEdit.title);
            setUrgency(reqToEdit.urgency);
            setSelectedType(reqToEdit.type);
            setItems(reqToEdit.items || []);
            setAttachments(reqToEdit.attachments || []);
          } else {
             console.error("Failed to load requisition for edit");
          }
        } catch (err) {
          console.error("Error loading edit data", err);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadEditData();
  }, [editId]);

  // Determine available types based on role
  const getAvailableTypes = () => {
    if (!user) return [];
    
    switch (user.role) {
      case UserRole.LAB:
        return [
          { type: RequisitionType.LAB_PURCHASE_ORDER, icon: ClipboardList, label: 'Lab Purchase Order', desc: 'Standard supplies & reagents' },
          { type: RequisitionType.EQUIPMENT_REQUEST, icon: Microscope, label: 'Equipment Request', desc: 'New devices or maintenance' },
          { type: RequisitionType.OUTSOURCED_HISTOLOGY_PAYMENT, icon: Zap, label: 'Histology Payment', desc: 'Outsourced service payments' },
        ];
      case UserRole.PHARMACY:
        return [
          { type: RequisitionType.PHARMACY_PURCHASE_ORDER, icon: Pill, label: 'Pharmacy PO', desc: 'Regular drug restocking' },
          { type: RequisitionType.EMERGENCY_DRUG_PURCHASE_1_MONTH, icon: Zap, label: 'Emergency (1 Month)', desc: 'Urgent 30-day supply' },
          { type: RequisitionType.EMERGENCY_DRUG_PURCHASE_1_WEEK, icon: CalendarClock, label: 'Emergency (1 Week)', desc: 'Short-term critical supply' },
          { type: RequisitionType.DAILY_DRUG_PURCHASE, icon: Clock, label: 'Daily Purchase', desc: 'Day-to-day operational needs' },
        ];
      default:
        return [
          { type: RequisitionType.GENERAL_REQUEST, icon: ClipboardList, label: 'General Request', desc: 'Office supplies & misc' }
        ];
    }
  };

  const availableTypes = getAvailableTypes();

  // Helper to check for special forms
  const isHistology = selectedType === RequisitionType.OUTSOURCED_HISTOLOGY_PAYMENT;
  const isEmergencyDrug1Month = selectedType === RequisitionType.EMERGENCY_DRUG_PURCHASE_1_MONTH;
  const isEmergencyDrug1Week = selectedType === RequisitionType.EMERGENCY_DRUG_PURCHASE_1_WEEK;
  const isPharmacyPO = selectedType === RequisitionType.PHARMACY_PURCHASE_ORDER;
  const isEquipment = selectedType === RequisitionType.EQUIPMENT_REQUEST;

  const addItem = () => {
    setItems([...items, { id: Date.now(), name: '', quantity: 1, stockLevel: 0, unit: 'pcs', isAvailable: true, notes: '', unitPrice: '', supplier: '', payee: '' }]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        const base64 = await fileToBase64(file);
        setAttachments([...attachments, { name: file.name, url: base64, type: file.type }]);
      } catch (error) {
        console.error("Error converting file", error);
        alert("Error uploading file");
      }
    }
  };
  
  // Smart Excel Import Logic
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use FileReader + SheetJS to parse content
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const bstr = evt.target?.result;
            // @ts-ignore
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            // @ts-ignore
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }); // Read as array of arrays

            if (!data || data.length === 0) return;

            // Simple "AI" Heuristics to find columns
            const rawHeaders = data[0] as any[] || [];
            // Use Array.from to safely handle sparse arrays (empty header cells)
            const headers = Array.from(rawHeaders).map(h => h ? String(h).toLowerCase().trim() : '');
            
            // Helper: Find column index with exclusions
            const getIndex = (keywords: string[], excludes: string[] = []) => {
                // 1. Exact match priority (check if header strictly equals a keyword)
                const exact = headers.findIndex(h => keywords.some(k => h === k));
                if (exact !== -1) return exact;

                // 2. Partial match (excluding 'excludes')
                return headers.findIndex(h => 
                    keywords.some(k => h.includes(k)) && 
                    !excludes.some(e => h.includes(e))
                );
            };

            // HISTOLOGY IMPORT LOGIC
            if (isHistology) {
                const dateIdx = getIndex(['date', 'created']);
                const patientIdx = getIndex(['patient', 'name', 'client'], ['test', 'service', 'investigation']);
                const hospIdx = getIndex(['hospital', 'hosp', 'mrn', 'file', 'folder', 'card']);
                const labIdx = getIndex(['lab', 'accession']);
                const testIdx = getIndex(['test', 'investigation', 'service', 'specimen', 'description']); // Map to 'name'
                const billIdx = getIndex(['bill', 'price', 'amount', 'cost', 'outsource'], ['zmc', 'charge']); // Map to 'unitPrice'
                const zmcIdx = getIndex(['zmc', 'charge']); // Map to 'zmcPrice'
                const refIdx = getIndex(['receipt', 'ref', 'hmo', 'payment']); // Map to 'paymentReference'
                const retainIdx = getIndex(['retain', 'category']); // Map to 'retainership'

                if (patientIdx === -1 && testIdx === -1) {
                    alert("Could not identify 'Patient Name' or 'Test/Service' columns. Please check your Excel headers.");
                    return;
                }

                const extractedItems = (data.slice(1) as any[]).map((row) => {
                    // Handle sparse data
                    if (!row) return null;
                    
                    // Validation: Need at least patient or test name
                    const pName = patientIdx !== -1 ? row[patientIdx] : '';
                    const tName = testIdx !== -1 ? row[testIdx] : '';
                    if (!pName && !tName) return null;

                    // Date parsing helper (Excel serial -> JS Date -> YYYY-MM-DD)
                    let dateVal = '';
                    if (dateIdx !== -1 && row[dateIdx]) {
                        const val = row[dateIdx];
                        if (typeof val === 'number') {
                            try {
                                // Excel epoch (1900) adjustment
                                const d = new Date(Math.round((val - 25569) * 86400 * 1000));
                                dateVal = d.toISOString().split('T')[0];
                            } catch(e) {}
                        } else {
                            // Try string parse
                            const d = new Date(val);
                            if (!isNaN(d.getTime())) {
                                dateVal = d.toISOString().split('T')[0];
                            }
                        }
                    }

                    return {
                        id: Date.now() + Math.random(),
                        customDate: dateVal,
                        patientName: pName ? String(pName) : '',
                        hospitalNumber: hospIdx !== -1 ? String(row[hospIdx] || '') : '',
                        labNumber: labIdx !== -1 ? String(row[labIdx] || '') : '',
                        name: tName ? String(tName) : '', // Test Name
                        unitPrice: billIdx !== -1 ? (parseFloat(row[billIdx]) || '') : '',
                        zmcPrice: zmcIdx !== -1 ? (parseFloat(row[zmcIdx]) || '') : '',
                        paymentReference: refIdx !== -1 ? String(row[refIdx] || '') : '',
                        retainership: retainIdx !== -1 ? String(row[retainIdx] || '') : '',
                        quantity: 1, // Default to 1
                        stockLevel: 0,
                        isAvailable: true,
                        notes: '',
                        payee: ''
                    };
                }).filter(Boolean);

                if (extractedItems.length > 0) {
                    if (items.length === 1 && !items[0].patientName && !items[0].name) {
                        setItems(extractedItems);
                    } else {
                        setItems([...items, ...extractedItems]);
                    }
                    alert(`✨ Successfully extracted ${extractedItems.length} records from Excel!`);
                } else {
                    alert("No valid records found in the file.");
                }
                return; // Stop here for Histology
            }

            // PHARMACY / GENERAL IMPORT LOGIC
            const nameIdx = getIndex(['description', 'item', 'name', 'drug', 'product', 'medicine']);
            
            // Updated Quantity Logic: Exclude stock-related terms
            const qtyIdx = getIndex(['qty', 'quantity', 'count', 'needed', 'req'], ['stock', 'level', 'hand', 'balance', 'available']);
            
            const unitIdx = getIndex(['unit', 'pack', 'form', 'type']);
            
            // Price often called 'price', 'cost', 'rate'. Sometimes 'amount' (if not quantity).
            const priceIdx = getIndex(['price', 'rate', 'cost', 'unit price', 'amount'], ['total']);
            
            const supplierIdx = getIndex(['supplier', 'vendor', 'source']);

            if (nameIdx === -1) {
                alert("Could not identify 'Item Name' or 'Description' column. Please check your Excel headers.");
                return;
            }

            const extractedItems = (data.slice(1) as any[]).map((row) => {
                // Handle sparse data rows safely
                if (!row) return null;
                
                const name = row[nameIdx];
                if (!name) return null; // Skip empty rows

                return {
                    id: Date.now() + Math.random(),
                    name: String(name),
                    quantity: qtyIdx !== -1 ? (parseInt(row[qtyIdx]) || 1) : 1,
                    unit: unitIdx !== -1 ? (row[unitIdx] || 'pcs') : 'pcs',
                    unitPrice: priceIdx !== -1 ? (parseFloat(row[priceIdx]) || '') : '',
                    supplier: supplierIdx !== -1 ? (row[supplierIdx] || '') : '',
                    stockLevel: 0,
                    isAvailable: true,
                    notes: '',
                    payee: ''
                };
            }).filter(Boolean);

            if (extractedItems.length > 0) {
                // If the current list only has one empty item, replace it. Otherwise append.
                if (items.length === 1 && !items[0].name) {
                    setItems(extractedItems);
                } else {
                    setItems([...items, ...extractedItems]);
                }
                alert(`✨ Successfully extracted ${extractedItems.length} items from Excel!`);
            } else {
                alert("No valid items found in the file.");
            }
        } catch (error) {
            console.error("Excel parse error:", error);
            alert("Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.");
        }
    };
    reader.readAsBinaryString(file);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!title || !selectedType || items.length === 0) return;
    setShowSignatureModal(true);
  };

  const handleSignatureConfirm = async (type: 'DRAWN' | 'STAMP', data: string) => {
    if (!user || !selectedType) return;
    setIsSubmitting(true);

    // Determine specific workflow stage based on type
    let initialStage = WorkflowStage.CHAIRMAN_INITIAL; // Default (Lab PO)

    if (selectedType === RequisitionType.PHARMACY_PURCHASE_ORDER) {
      initialStage = WorkflowStage.AUDIT_ONE;
    } else if (selectedType === RequisitionType.EMERGENCY_DRUG_PURCHASE_1_MONTH) {
       initialStage = WorkflowStage.AUDIT_TWO;
    } else if (selectedType === RequisitionType.EMERGENCY_DRUG_PURCHASE_1_WEEK) {
       initialStage = WorkflowStage.AUDIT_ONE;
    } else if (selectedType === RequisitionType.DAILY_DRUG_PURCHASE) {
       initialStage = WorkflowStage.CHAIRMAN_INITIAL;
    } else if (selectedType === RequisitionType.OUTSOURCED_HISTOLOGY_PAYMENT) {
      initialStage = WorkflowStage.AUDIT_ONE;
    } else if (selectedType === RequisitionType.EQUIPMENT_REQUEST) {
      initialStage = WorkflowStage.CHAIRMAN_INITIAL;
    } else if (selectedType === RequisitionType.LAB_PURCHASE_ORDER) {
       initialStage = WorkflowStage.CHAIRMAN_INITIAL;
    }

    // Creating the object
    const newRequisition: Requisition = {
      id: editId || `req-${Math.floor(1000 + Math.random() * 9000)}`,
      requesterId: user.id,
      requesterName: user.name,
      department: user.department,
      type: selectedType,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: RequisitionStatus.PENDING, 
      currentStage: initialStage,        
      urgency,
      items: items.map(i => ({
        ...i,
        id: i.id.toString(),
        unitPrice: (isEmergencyDrug1Month || isEmergencyDrug1Week) ? (parseFloat(i.unitPrice) || 0) : (parseFloat(i.unitPrice) || undefined),
        payee: i.payee
      })),
      attachments,
      rejectionReason: null as any, 
      approvals: [{
        id: `app_${Date.now()}`,
        approverId: user.id,
        approverName: user.name,
        role: user.role,
        department: user.department,
        stage: WorkflowStage.REQUESTER,
        timestamp: new Date().toISOString(),
        signatureType: type,
        signatureData: data
      }]
    };

    try {
      if (editId) {
        await updateRequisition(newRequisition);
      } else {
        if (selectedType === RequisitionType.PHARMACY_PURCHASE_ORDER || selectedType === RequisitionType.EQUIPMENT_REQUEST || selectedType === RequisitionType.LAB_PURCHASE_ORDER) {
          const suppliers = new Set(items.map(i => i.supplier ? i.supplier.trim() : '').filter(Boolean));
          if (suppliers.size > 1) {
             const supplierArray = Array.from(suppliers);
             for (const [idx, supplier] of supplierArray.entries()) {
               const supplierItems = items.filter(i => (i.supplier && i.supplier.trim() === supplier)).map(i => ({...i, id: i.id.toString()}));
               const childReq = {
                 ...newRequisition,
                 id: `req-${Math.floor(1000 + Math.random() * 9000)}-${idx}`,
                 title: `PO: ${supplier} - ${title}`,
                 items: supplierItems,
                 status: RequisitionStatus.PENDING,
                 currentStage: newRequisition.currentStage 
               };
               await addRequisition(childReq);
             }
             alert('Request submitted and split into multiple requests based on suppliers.');
             navigate('/requisitions');
             return;
          }
        }
        
        await addRequisition(newRequisition);
      }
      navigate('/requisitions');
    } catch (error) {
      console.error("Error saving requisition:", error);
      alert("Failed to save requisition. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500">Loading form data...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="mb-6">
        <button onClick={() => navigate('/requisitions')} className="flex items-center text-gray-500 hover:text-gray-900 mb-4 transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Back to My Requisitions
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{editId ? 'Edit Requisition' : 'New Requisition'}</h1>
        <p className="text-gray-500 mt-1">Fill out the form below to submit a new request for approval.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            
            {!editId && (
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-3">Requisition Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableTypes.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.type}
                        onClick={() => {
                          setSelectedType(t.type);
                          if (t.type === RequisitionType.EMERGENCY_DRUG_PURCHASE_1_MONTH || t.type === RequisitionType.EMERGENCY_DRUG_PURCHASE_1_WEEK) {
                             const today = new Date().toISOString().split('T')[0];
                             setItems([{ id: Date.now(), customDate: today, payee: '', unitPrice: '', notes: '', quantity: 1 }]);
                          } else if (t.type === RequisitionType.OUTSOURCED_HISTOLOGY_PAYMENT) {
                             setItems([{ id: Date.now(), customDate: '', patientName: '', hospitalNumber: '', labNumber: '', paymentReference: '', name: '', unitPrice: '', zmcPrice: '', retainership: '', quantity: 1 }]);
                          } else {
                             setItems([{ id: Date.now(), name: '', quantity: 1, stockLevel: 0, unit: 'pcs', notes: '', unitPrice: '', supplier: '' }]);
                          }
                        }}
                        className={`flex items-start p-4 rounded-xl border text-left transition-all ${selectedType === t.type ? 'border-zankli-orange bg-orange-50 ring-1 ring-zankli-orange' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                      >
                        <div className={`p-2 rounded-lg mr-3 ${selectedType === t.type ? 'bg-zankli-orange text-white' : 'bg-gray-100 text-gray-500'}`}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${selectedType === t.type ? 'text-zankli-orange' : 'text-gray-900'}`}>{t.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedType && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Request Title</label>
                    <input
                      type="text"
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange"
                      placeholder={isEmergencyDrug1Week ? "e.g. Weekly Emergency Purchase" : isEmergencyDrug1Month ? "e.g. Monthly Emergency Restock" : "e.g. Weekly Reagents Restock"}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Urgency Level</label>
                    <select
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange"
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                    >
                      {Object.values(UrgencyLevel).map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
                    <h3 className="font-semibold text-gray-900">
                      {(isEmergencyDrug1Month || isEmergencyDrug1Week) ? 'Payment Details' : isHistology ? 'Histology Details' : 'Items Needed'}
                    </h3>
                    
                    {/* "AI" Excel Import Button - Only for Pharmacy PO OR Histology */}
                    {(isPharmacyPO || isHistology) && (
                      <div className="relative">
                        <input 
                            type="file" 
                            id="excel-upload" 
                            className="hidden" 
                            accept=".xlsx, .xls"
                            onChange={handleExcelImport}
                        />
                        <label 
                            htmlFor="excel-upload"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full cursor-pointer hover:shadow-md transition-all transform hover:-translate-y-0.5"
                            title="Automatically extract items from an Excel file"
                        >
                            <Sparkles size={14} />
                            Smart Import from Excel
                        </label>
                      </div>
                    )}
                  </div>

                  {(isEmergencyDrug1Month || isEmergencyDrug1Week) ? (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Date</label>
                        <input
                          type="date"
                          value={items[0].customDate || ''}
                          onChange={(e) => updateItem(items[0].id, 'customDate', e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange"
                        />
                      </div>
                      
                      {isEmergencyDrug1Month && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Please Pay (Payee)</label>
                          <input
                            type="text"
                            value={items[0].payee}
                            onChange={(e) => updateItem(items[0].id, 'payee', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange"
                            placeholder="Enter name of payee..."
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">The Sum Of (Amount)</label>
                        <div className="relative">
                           <span className="absolute left-3 top-2 text-gray-500">₦</span>
                           <input
                            type="number"
                            value={items[0].unitPrice}
                            onChange={(e) => updateItem(items[0].id, 'unitPrice', e.target.value)}
                            className="block w-full pl-8 rounded-md border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange"
                            placeholder="0.00"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic border-l-2 border-zankli-orange pl-2">
                           {items[0].unitPrice ? numberToWords(parseFloat(items[0].unitPrice)) : 'Zero Naira Only'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                          {isEmergencyDrug1Week ? 'Purpose (e.g. Purchase of Cannular)' : 'Being (Purpose)'}
                        </label>
                        <textarea
                          value={items[0].notes}
                          onChange={(e) => updateItem(items[0].id, 'notes', e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange"
                          rows={3}
                          placeholder={isEmergencyDrug1Week ? "e.g. Purchase of Cannular" : "Purpose of payment..."}
                        />
                      </div>
                    </div>
                  ) : isHistology ? (
                    <div className="space-y-3">
                        {items.map((item, index) => (
                           <div key={item.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative group">
                              <button onClick={() => removeItem(item.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={16} />
                              </button>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div>
                                   <label className="text-[10px] uppercase text-gray-500 font-bold">Date</label>
                                   <input type="date" value={item.customDate || ''} onChange={(e) => updateItem(item.id, 'customDate', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-zankli-orange focus:border-zankli-orange" />
                                </div>
                                <div>
                                   <label className="text-[10px] uppercase text-gray-500 font-bold">Patient Name</label>
                                   <input type="text" value={item.patientName || ''} onChange={(e) => updateItem(item.id, 'patientName', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-zankli-orange focus:border-zankli-orange" />
                                </div>
                                <div>
                                   <label className="text-[10px] uppercase text-gray-500 font-bold">Hosp No.</label>
                                   <input type="text" value={item.hospitalNumber || ''} onChange={(e) => updateItem(item.id, 'hospitalNumber', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-zankli-orange focus:border-zankli-orange" />
                                </div>
                                <div>
                                   <label className="text-[10px] uppercase text-gray-500 font-bold">Lab No.</label>
                                   <input type="text" value={item.labNumber || ''} onChange={(e) => updateItem(item.id, 'labNumber', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-zankli-orange focus:border-zankli-orange" />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div>
                                   <label className="text-[10px] uppercase text-gray-500 font-bold">Outsource Service</label>
                                   <input type="text" value={item.name || ''} onChange={(e) => updateItem(item.id, 'name', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-zankli-orange focus:border-zankli-orange" placeholder="Test Name" />
                                </div>
                                <div>
                                   <label className="text-[10px] uppercase text-gray-500 font-bold">Outsource Bill (₦)</label>
                                   <input type="number" value={item.unitPrice || ''} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-zankli-orange focus:border-zankli-orange" />
                                </div>
                                <div>
                                   <label className="text-[10px] uppercase text-gray-500 font-bold">ZMC Charges (₦)</label>
                                   <input type="number" value={item.zmcPrice || ''} onChange={(e) => updateItem(item.id, 'zmcPrice', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-zankli-orange focus:border-zankli-orange" />
                                </div>
                                <div>
                                   <label className="text-[10px] uppercase text-gray-500 font-bold">Receipt/HMO</label>
                                   <input type="text" value={item.paymentReference || ''} onChange={(e) => updateItem(item.id, 'paymentReference', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-zankli-orange focus:border-zankli-orange" />
                                </div>
                                <div>
                                   <label className="text-[10px] uppercase text-gray-500 font-bold">Retainership</label>
                                   <input type="text" value={item.retainership || ''} onChange={(e) => updateItem(item.id, 'retainership', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-zankli-orange focus:border-zankli-orange" />
                                </div>
                              </div>
                           </div>
                        ))}
                         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-2 gap-4">
                           <button onClick={addItem} className="flex items-center text-sm font-medium text-zankli-orange hover:text-orange-700">
                             <Plus size={16} className="mr-1" /> Add Another Patient
                          </button>
                          <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-100 flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-500 uppercase">Total Outsource Bill:</span>
                            <span className="text-lg font-bold text-zankli-orange">
                              ₦{items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div key={item.id} className="flex flex-col md:flex-row gap-3 items-start bg-gray-50 p-3 rounded-lg border border-gray-200 group">
                          <div className="flex-1 w-full">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Item Description</label>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange text-sm"
                              placeholder="Item name..."
                            />
                          </div>
                          
                          <div className="w-24">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange text-sm"
                            />
                          </div>
                          
                          {selectedType !== RequisitionType.DAILY_DRUG_PURCHASE && (
                             <div className="w-24">
                               <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                               <input
                                 type="text"
                                 value={item.unit}
                                 onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                 className="block w-full rounded-md border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange text-sm"
                               />
                             </div>
                          )}

                          {(isPharmacyPO || isEquipment) && (
                            <>
                              <div className="w-32">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price (₦)</label>
                                <input
                                  type="number"
                                  value={item.unitPrice}
                                  onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange text-sm"
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="w-40">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Supplier</label>
                                <input
                                  type="text"
                                  value={item.supplier}
                                  onChange={(e) => updateItem(item.id, 'supplier', e.target.value)}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange text-sm"
                                  placeholder="Supplier Name"
                                />
                              </div>
                            </>
                          )}

                          {!isPharmacyPO && !isEquipment && (
                             <div className="w-24">
                               <label className="block text-xs font-medium text-gray-500 mb-1">Stock Level</label>
                               <input
                                  type="number"
                                  value={item.stockLevel}
                                  onChange={(e) => updateItem(item.id, 'stockLevel', parseInt(e.target.value) || 0)}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange text-sm"
                                />
                             </div>
                          )}

                          <div className="pt-6">
                            <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      <button onClick={addItem} className="flex items-center text-sm font-medium text-zankli-orange hover:text-orange-700 mt-2">
                        <Plus size={16} className="mr-1" /> Add Another Item
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {!selectedType && (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <ClipboardList size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Please select a requisition type above to start.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
               <Upload size={18} /> Attachments
            </h3>
            
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span></p>
                <p className="text-xs text-gray-500">PDF, PNG, JPG</p>
              </div>
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg" />
            </label>

            {attachments.length > 0 && (
              <ul className="mt-4 space-y-2">
                {attachments.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded border border-gray-100">
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <button onClick={() => removeAttachment(idx)} className="text-red-500 hover:text-red-700">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedType || !title || items.length === 0 || isSubmitting}
            className={`w-full py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 font-bold text-lg transition-all transform hover:-translate-y-1 ${!selectedType || !title || isSubmitting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-zankli-orange text-white hover:bg-orange-700 shadow-zankli-orange/20'}`}
          >
            <Send size={20} />
            {isSubmitting ? 'Processing...' : (editId ? 'Update & Resubmit' : 'Submit Request')}
          </button>
        </div>
      </div>

      {showSignatureModal && user && (
        <SignatureModal 
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onConfirm={handleSignatureConfirm}
          user={user}
        />
      )}
    </div>
  );
};

export default NewRequisition;
