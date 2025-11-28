import React, { useRef, useState, useEffect } from 'react';
import { X, CheckCircle, Eraser, PenTool, Lock, AlertTriangle, CornerUpLeft, Ban } from 'lucide-react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: 'DRAWN' | 'STAMP', data: string, comment?: string) => void | Promise<void>;
  user: User;
  actionType?: 'APPROVE' | 'REJECT' | 'RETURN';
  commentLabel?: string;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  user,
  actionType = 'APPROVE',
  commentLabel
}) => {
  const [activeTab, setActiveTab] = useState<'DRAW' | 'PASSWORD'>('PASSWORD');
  const [password, setPassword] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'DRAW' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';
      }
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const getPosition = (event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = (event as React.MouseEvent).clientX;
      clientY = (event as React.MouseEvent).clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPosition(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
     if (e.cancelable) e.preventDefault();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = async () => {
    setError('');
    setIsProcessing(true);

    // Require comment for Reject/Return
    if ((actionType === 'REJECT' || actionType === 'RETURN') && !comment.trim()) {
      setError(`Please provide a reason to ${actionType.toLowerCase()} this request.`);
      setIsProcessing(false);
      return;
    }

    try {
      if (activeTab === 'DRAW') {
        if (!hasDrawn) {
          setError("Please sign above.");
          setIsProcessing(false);
          return;
        }
        const canvas = canvasRef.current;
        if (canvas) {
          const dataUrl = canvas.toDataURL('image/png');
          await onConfirm('DRAWN', dataUrl, comment);
        }
      } else {
        // Validate Password using Supabase Auth check
        setVerifying(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password
            });

            if (data.user && !error) {
                await onConfirm('STAMP', 'VALIDATED_STAMP', comment);
            } else {
                setError("Incorrect password. Please try again.");
            }
        } catch (err) {
            setError("Error verifying password.");
        } finally {
            setVerifying(false);
        }
      }
    } catch (err) {
      console.error("Signature confirmation error:", err);
      setError("Failed to process signature. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getActionTitle = () => {
    switch(actionType) {
      case 'REJECT': return 'Reject Request';
      case 'RETURN': return 'Return Request';
      default: return 'Authorize Request';
    }
  };

  const getButtonColor = () => {
    switch(actionType) {
      case 'REJECT': return 'bg-red-600 hover:bg-red-700 shadow-red-900/10';
      case 'RETURN': return 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/10';
      default: return 'bg-zankli-orange hover:bg-orange-700 shadow-orange-900/10';
    }
  };

  const getButtonIcon = () => {
    switch(actionType) {
      case 'REJECT': return <Ban size={18} />;
      case 'RETURN': return <CornerUpLeft size={18} />;
      default: return <CheckCircle size={18} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h3 className={`text-lg font-bold ${actionType === 'REJECT' ? 'text-red-700' : actionType === 'RETURN' ? 'text-amber-700' : 'text-gray-900'}`}>
            {getActionTitle()}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => setActiveTab('PASSWORD')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'PASSWORD' ? 'text-zankli-orange border-b-2 border-zankli-orange bg-orange-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Lock size={16} /> Digital Stamp
          </button>
          <button
            onClick={() => setActiveTab('DRAW')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'DRAW' ? 'text-zankli-orange border-b-2 border-zankli-orange bg-orange-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <PenTool size={16} /> Draw Signature
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {/* Comment Field (Mandatory for Reject/Return) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {commentLabel || (actionType === 'APPROVE' ? 'Comments (Optional)' : 'Reason / Comment (Required)')}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange p-2.5 border text-sm"
              rows={3}
              placeholder={actionType === 'REJECT' ? "Reason for rejection..." : actionType === 'RETURN' ? "Reason for sending back..." : "Any additional notes..."}
            ></textarea>
          </div>

          {activeTab === 'PASSWORD' ? (
            <div className="space-y-4">
              <div className="text-center mb-6">
                 <div className={`w-24 h-24 mx-auto rounded-full border-4 border-double flex flex-col items-center justify-center rotate-[-12deg] mb-4 shadow-sm opacity-80
                   ${actionType === 'REJECT' ? 'border-red-800 text-red-900 bg-red-50' : 
                     actionType === 'RETURN' ? 'border-amber-800 text-amber-900 bg-amber-50' : 
                     'border-blue-800 text-blue-900 bg-blue-50'}
                 `}>
                   <span className="text-[10px] font-bold uppercase tracking-wider">
                     {actionType === 'REJECT' ? 'REJECTED' : actionType === 'RETURN' ? 'RETURNED' : 'APPROVED'}
                   </span>
                   <span className="text-xs font-bold text-center px-1 leading-tight">{user.department}</span>
                   <span className="text-[8px] mt-1">{new Date().toLocaleDateString()}</span>
                   <span className="text-[8px] font-serif italic">{user.name}</span>
                 </div>
                 <p className="text-sm text-gray-500">Enter your password to apply your official department stamp.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-zankli-orange focus:ring-zankli-orange p-2.5 border"
                  placeholder="Enter password..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 text-center">Sign your name in the box below.</p>
              <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 relative touch-none">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={200}
                  className="w-full h-48 cursor-crosshair touch-none select-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                <button 
                  onClick={clearCanvas}
                  className="absolute top-2 right-2 p-1.5 bg-white shadow-sm border border-gray-200 rounded text-gray-500 hover:text-red-500"
                  title="Clear"
                >
                  <Eraser size={16} />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={verifying || isProcessing}
            className={`px-6 py-2 text-white font-bold rounded-lg shadow-md flex items-center gap-2 ${getButtonColor()} ${(verifying || isProcessing) ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {verifying ? 'Verifying...' : isProcessing ? 'Processing...' : (
                <>
                    {getButtonIcon()}
                    {activeTab === 'PASSWORD' ? 'Stamp & Confirm' : 'Sign & Confirm'}
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;