
import { Requisition, RequisitionStatus, WorkflowStage, UserRole, User } from './types';

export const formatDateTime = (isoString: string): string => {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Lagos'
    });
  } catch (e) {
    return isoString;
  }
};

export const formatDate = (isoString: string): string => {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Africa/Lagos'
    });
  } catch (e) {
    return isoString;
  }
};

export const numberToWords = (n: number): string => {
  if (n === 0) return 'Zero Naira Only';
  
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion'];

  const convertChunk = (num: number): string => {
    let words = '';
    if (num >= 100) {
      words += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
      if (num > 0) words += 'and ';
    }
    if (num > 0) {
      if (num < 20) {
        words += units[num] + ' ';
      } else {
        words += tens[Math.floor(num / 10)] + ' ';
        if (num % 10 > 0) words += '-' + units[num % 10] + ' ';
      }
    }
    return words;
  };

  let words = '';
  let scaleIndex = 0;
  
  // Handle integer part
  let integerPart = Math.floor(n);
  
  if (integerPart === 0) return 'Zero Naira Only';

  while (integerPart > 0) {
    const chunk = integerPart % 1000;
    if (chunk > 0) {
      const chunkWords = convertChunk(chunk);
      words = chunkWords + (scales[scaleIndex] ? scales[scaleIndex] + ' ' : '') + words;
    }
    integerPart = Math.floor(integerPart / 1000);
    scaleIndex++;
  }

  return (words.trim() + ' Naira Only').toUpperCase();
};

export const isUserTurn = (req: Requisition, user: User | null): boolean => {
  if (!user) return false;
  // If returned and I am the requester, it's my turn to edit
  if (req.status === RequisitionStatus.RETURNED && req.requesterId === user.id) return true;
  
  // If pending, check stage vs role
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
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
