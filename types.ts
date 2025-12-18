

// User Roles
export enum UserRole {
  ADMIN = 'admin',
  PHARMACY = 'pharmacy',
  LAB = 'lab',
  ACCOUNTS = 'accounts',
  AUDIT = 'audit',
  FINANCE = 'finance',
  CHAIRMAN = 'chairman',
  DOCTOR = 'doctor'
}

// User Profile
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  department: string;
}

// Specific Request Types
export enum RequisitionType {
  // Lab Types
  LAB_PURCHASE_ORDER = 'Lab Purchase Order',
  EQUIPMENT_REQUEST = 'Equipment Request',
  OUTSOURCED_HISTOLOGY_PAYMENT = 'Outsourced Histology Payment',

  // Pharmacy Types
  PHARMACY_PURCHASE_ORDER = 'Pharmacy Purchase Order',
  EMERGENCY_DRUG_PURCHASE_1_MONTH = 'Emergency Drug Purchase (1 month)',
  EMERGENCY_DRUG_PURCHASE_1_WEEK = 'Emergency Drug Purchase (1 week)',
  DAILY_DRUG_PURCHASE = 'Approval for Daily Drug Purchase',

  // Fallback
  GENERAL_REQUEST = 'General Request'
}

// Requisition Status
export enum RequisitionStatus {
  DRAFT = 'Draft',
  PENDING = 'Pending Approval',
  RETURNED = 'Returned', // For "Sent Back" requests
  IN_REVIEW = 'In Review',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  FULFILLED = 'Fulfilled'
}

// Detailed Workflow Stages (Specifically for Lab PO)
export enum WorkflowStage {
  REQUESTER = 'Requester',
  DRAFT_EDIT = 'Draft / Edit',
  CHAIRMAN_INITIAL = 'Chairman (Initial)',
  STORE_CHECK = 'Store Check',
  AUDIT_ONE = 'Audit 1',
  AUDIT_TWO = 'Audit 2',
  CHAIRMAN_FINAL = 'Chairman (Final)',
  HOF_APPROVAL = 'Head of Finance',
  COMPLETED = 'Completed'
}

// Urgency Levels
export enum UrgencyLevel {
  LOW = 'Low',
  NORMAL = 'Normal',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

// Requisition Item
export interface RequisitionItem {
  id: string;
  name: string;
  stockLevel?: number;
  quantity: number;
  unit: string;
  notes?: string;
  // Store Fields
  unitPrice?: number;
  supplier?: string;
  isAvailable?: boolean; // If false, item is skipped in PO generation

  // Outsourced Histology Fields
  customDate?: string;
  patientName?: string;
  hospitalNumber?: string;
  labNumber?: string;
  paymentReference?: string; // Receipt No/HMO/COY
  zmcPrice?: number; // ZMC Charges
  retainership?: string;
  
  // Emergency Drug Fields
  payee?: string;
}

// Approval Signature Record
export interface Approval {
  id: string;
  approverId: string;
  approverName: string;
  role: UserRole;
  department: string;
  stage: WorkflowStage;
  timestamp: string; // ISO Date
  signatureType: 'DRAWN' | 'STAMP';
  signatureData: string; // Base64 string for drawn, or "VALIDATED_STAMP" for password
  comment?: string; // Reason for rejection, return, or general notes
}

// Payment Record
export interface Payment {
  id: string;
  amount: number;
  date: string;
  recordedBy: string;
  notes?: string;
  evidenceUrl?: string; // Attachment URL for receipt/proof
}

// Requisition Record
export interface Requisition {
  id: string;
  requesterId: string;
  requesterName: string;
  department: string;
  type: RequisitionType; 
  title: string;
  createdAt: string; // ISO Date
  updatedAt: string; // ISO Date
  status: RequisitionStatus;
  currentStage?: WorkflowStage;
  urgency: UrgencyLevel;
  items: RequisitionItem[];
  approverId?: string;
  rejectionReason?: string;
  
  // Reminder System
  lastRemindedAt?: string;
  reminderCount?: number;

  // Attachments (Can be string URLs or File objects converted to ObjectURLs)
  attachments?: { name: string; url: string; type: string }[];
  
  // Approval History
  approvals: Approval[];
  
  // Payment History (For Accounts)
  payments?: Payment[];

  // For split POs
  isParent?: boolean;
  parentId?: string;
  childRequisitionIds?: string[];
}

// Mock Database Structure
export interface Database {
  users: User[];
  requisitions: Requisition[];
}