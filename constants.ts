
import { RequisitionStatus, UserRole, UrgencyLevel, RequisitionType, WorkflowStage, Requisition } from './types';

// Extended type for mock users to include password locally
export const MOCK_USERS = [
  {
    id: 'u_lab',
    name: 'Lab Admin',
    email: 'labzankli@gmail.com',
    password: 'labreq1',
    role: UserRole.LAB,
    department: 'Laboratory',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LabAdmin'
  },
  {
    id: 'u_pharm',
    name: 'Pharmacy Admin',
    email: 'storezankli@gmail.com',
    password: 'storereq2',
    role: UserRole.PHARMACY,
    department: 'Pharmacy',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PharmAdmin'
  },
  {
    id: 'u_acct',
    name: 'Account Officer',
    email: 'acct.zankli@gmail.com',
    password: 'ayozank',
    role: UserRole.ACCOUNTS,
    department: 'Accounts',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Account'
  },
  {
    id: 'u_audit1',
    name: 'Auditor 1',
    email: 'auditorzankli@gmail.com',
    password: 'zankliaudit1',
    role: UserRole.AUDIT,
    department: 'Audit',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Audit1'
  },
  {
    id: 'u_audit2',
    name: 'Auditor 2',
    email: 'auditor2zankli@gmail.com',
    password: 'uche2audit',
    role: UserRole.AUDIT,
    department: 'Audit',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Audit2'
  },
  {
    id: 'u_finance',
    name: 'Head of Finance',
    email: 'hofzankli@gmail.com',
    password: 'vince1234',
    role: UserRole.FINANCE,
    department: 'Finance',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=FinanceHead'
  },
  {
    id: 'u_chair',
    name: 'The Chairman',
    email: 'chairmanzankli@gmail.com',
    password: 'funky101',
    role: UserRole.CHAIRMAN,
    department: 'Management',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chairman'
  }
];

export const INITIAL_REQUISITIONS: Requisition[] = [
  {
    id: 'req-1001',
    requesterId: 'u_pharm',
    requesterName: 'Pharmacy Admin',
    department: 'Pharmacy',
    type: RequisitionType.PHARMACY_PURCHASE_ORDER,
    title: 'Monthly Paracetamol Restock',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: RequisitionStatus.PENDING,
    currentStage: WorkflowStage.AUDIT_ONE,
    urgency: UrgencyLevel.NORMAL,
    items: [
      { id: 'i1', name: 'Paracetamol 500mg', quantity: 1000, stockLevel: 150, unit: 'Tablets', isAvailable: true, supplier: 'Emzor', unitPrice: 5 },
      { id: 'i2', name: 'Ibuprofen 400mg', quantity: 500, stockLevel: 45, unit: 'Tablets', isAvailable: true, supplier: 'M&B', unitPrice: 8 }
    ],
    approvals: []
  },
  {
    id: 'req-1002',
    requesterId: 'u_lab',
    requesterName: 'Lab Admin',
    department: 'Laboratory',
    type: RequisitionType.LAB_PURCHASE_ORDER,
    title: 'Urgent Reagents for Blood Works',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: RequisitionStatus.PENDING,
    currentStage: WorkflowStage.STORE_CHECK, // Ready for Store workflow testing
    urgency: UrgencyLevel.CRITICAL,
    items: [
      { id: 'i3', name: 'CBC Reagent Kit', quantity: 5, stockLevel: 1, unit: 'Kits', notes: 'Supplier A preferred', isAvailable: true },
      { id: 'i9', name: 'Malaria RDT Kit', quantity: 50, stockLevel: 10, unit: 'Box', isAvailable: true }
    ],
    attachments: [],
    approvals: []
  },
  {
    id: 'req-1003',
    requesterId: 'u_lab',
    requesterName: 'Lab Admin',
    department: 'Laboratory',
    type: RequisitionType.EQUIPMENT_REQUEST,
    title: 'Microscope Maintenance Kit',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    status: RequisitionStatus.RETURNED,
    currentStage: WorkflowStage.DRAFT_EDIT,
    urgency: UrgencyLevel.LOW,
    items: [
      { id: 'i4', name: 'Lens Cleaner', quantity: 2, stockLevel: 0, unit: 'Bottles', isAvailable: true }
    ],
    approverId: 'u_finance',
    rejectionReason: 'Please attach the specific quotation from the vendor.',
    approvals: []
  },
  {
    id: 'req-1004',
    requesterId: 'u_pharm',
    requesterName: 'Pharmacy Admin',
    department: 'Pharmacy',
    type: RequisitionType.EMERGENCY_DRUG_PURCHASE_1_WEEK,
    title: 'Antibiotics Emergency Supply',
    createdAt: new Date(Date.now() - 86400000 * 0.5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 0.5).toISOString(),
    status: RequisitionStatus.PENDING,
    currentStage: WorkflowStage.STORE_CHECK,
    urgency: UrgencyLevel.HIGH,
    items: [
      { id: 'i5', name: 'Amoxicillin 500mg', quantity: 200, stockLevel: 10, unit: 'Packs', isAvailable: true },
      { id: 'i6', name: 'Ciprofloxacin 500mg', quantity: 150, stockLevel: 12, unit: 'Packs', isAvailable: true }
    ],
    approvals: []
  }
];