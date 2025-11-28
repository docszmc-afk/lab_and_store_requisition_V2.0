
import React, { useEffect, useRef, useState } from 'react';
import { FileText, Download, ExternalLink, Eye } from 'lucide-react';

interface FilePreviewProps {
  url: string;
  name: string;
  type?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({ url, name, type }) => {
  const isPdf = type === 'application/pdf' || name.toLowerCase().endsWith('.pdf') || (url && url.startsWith('data:application/pdf'));
  const isImage = type?.startsWith('image/') || name.match(/\.(jpg|jpeg|png|gif)$/i) || (url && url.startsWith('data:image/'));
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isPdf && url) {
      const renderPdf = async () => {
        try {
          setLoading(true);
          setError('');
          
          // Access pdfjsLib from window (loaded via CDN in index.html)
          // @ts-ignore
          const pdfjsLib = window.pdfjsLib;
          
          if (!pdfjsLib) {
            console.error('PDF.js library not loaded');
            setError('PDF Library not ready');
            setLoading(false);
            return;
          }

          // Set worker source
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

          const loadingTask = pdfjsLib.getDocument(url);
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1); // Render first page
          
          const scale = 1.5;
          const viewport = page.getViewport({ scale });
          
          const canvas = canvasRef.current;
          if (canvas) {
            const context = canvas.getContext('2d');
            if (context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                  canvasContext: context,
                  viewport: viewport
                };
                await page.render(renderContext).promise;
            }
          }
          setLoading(false);
        } catch (err) {
          console.error('Error rendering PDF', err);
          setError('Preview unavailable');
          setLoading(false);
        }
      };

      renderPdf();
    }
  }, [url, isPdf]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 mt-3 break-inside-avoid">
      <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 truncate max-w-[70%]">
           {isPdf ? <FileText size={16} className="text-red-500 flex-shrink-0" /> : <FileText size={16} className="flex-shrink-0" />}
           <span className="truncate">{name}</span>
        </div>
        <div className="flex gap-2">
            <a 
            href={url} 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
            data-html2canvas-ignore
            >
            <Eye size={14} /> View
            </a>
            <a 
            href={url} 
            download={name}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
            data-html2canvas-ignore
            >
            <Download size={14} /> Download
            </a>
        </div>
      </div>
      
      <div className="relative bg-gray-200/50 flex items-center justify-center min-h-[200px] p-4">
        {isPdf ? (
          <div className="shadow-lg bg-white relative">
            <canvas ref={canvasRef} className="max-w-full h-auto block" />
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 z-10">
                    <div className="flex flex-col items-center">
                        <div className="w-6 h-6 border-2 border-zankli-orange border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span className="text-xs text-gray-500">Loading PDF...</span>
                    </div>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-center p-4">
                    <FileText size={32} className="text-red-300 mb-2" />
                    <span className="text-sm text-red-500 font-medium">{error}</span>
                    <p className="text-xs text-gray-400 mt-1">The PDF could not be rendered directly.</p>
                    <a href={url} download={name} className="text-xs underline mt-2 text-blue-600 hover:text-blue-800">Download to view</a>
                </div>
            )}
          </div>
        ) : isImage ? (
          <img src={url} alt={name} className="max-w-full max-h-[500px] object-contain shadow-md bg-white" />
        ) : (
          <div className="text-center p-8 text-gray-500">
            <FileText size={48} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">Preview not available</p>
            <p className="text-xs mt-1 text-gray-400">File type: {type || 'Unknown'}</p>
            <a href={url} download={name} className="text-blue-600 hover:underline text-xs mt-4 inline-flex items-center gap-1">
              Download to view <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePreview;
