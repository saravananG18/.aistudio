import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext.tsx';
import { QrCode, Maximize2, Minimize2, Download, Printer, ShieldCheck, AlertTriangle } from 'lucide-react';

interface StudentQRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudentQRModal: React.FC<StudentQRModalProps> = ({ isOpen, onClose }) => {
  const { user, qrIdentity, verifyEmail } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && qrIdentity?.opaque_qr_identifier && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        qrIdentity.opaque_qr_identifier,
        {
          width: isFullScreen ? 320 : 220,
          margin: 2,
          color: {
            dark: '#0F172A', // Slate 900
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'H'
        },
        (err) => {
          if (err) console.error('QR Render error:', err);
          if (canvasRef.current) {
            setDownloadUrl(canvasRef.current.toDataURL('image/png'));
          }
        }
      );
    }
  }, [isOpen, qrIdentity, isFullScreen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isFullScreen ? 'bg-black/95' : 'bg-slate-900/60 backdrop-blur-xs'}`}>
      <div 
        className={`bg-white rounded-2xl w-full transition-all border border-slate-200 shadow-2xl overflow-hidden flex flex-col ${
          isFullScreen ? 'max-w-md p-8 bg-white' : 'max-w-sm p-6'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">
              My Boarding Pass
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-semibold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="py-6 flex flex-col items-center text-center">
          
          {/* Unverified Email Warning */}
          {user && !user.is_verified && (
            <div className="mb-4 w-full p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unverified Email Address</p>
                <p className="text-[11px] mt-0.5">Please verify ownership of your email before reserving seats.</p>
                <button
                  onClick={verifyEmail}
                  className="mt-2 text-[11px] font-semibold text-amber-900 bg-amber-200/80 px-2.5 py-1 rounded-md hover:bg-amber-300"
                >
                  Verify Now (1-Click)
                </button>
              </div>
            </div>
          )}

          {/* Revoked Status Warning */}
          {qrIdentity?.status === 'REVOKED' ? (
            <div className="w-full p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <div className="font-bold text-sm mb-1">Pass Revoked</div>
              <p>This student QR identity was revoked by campus transport administration. Please visit the Transport Office to request a new identity pass.</p>
            </div>
          ) : qrIdentity?.opaque_qr_identifier ? (
            <>
              {/* QR Canvas Box */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs mb-4">
                <canvas ref={canvasRef} className="mx-auto" />
              </div>

              {/* Student Metadata */}
              <div className="space-y-1 mb-4">
                <h4 className="text-base font-bold text-slate-900">{user?.name}</h4>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-mono">
                  <span>ID: {user?.student_id_number || '22CIT042'}</span>
                  <span>·</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> ACTIVE PASS
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1 select-all">
                  {qrIdentity.opaque_qr_identifier}
                </div>
              </div>

              <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-6">
                Present this unforgeable QR identity to the driver upon boarding any reserved bus. The driver's scanner will automatically verify your seat reservation.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full">
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={`CIT_Pass_${user?.student_id_number || 'Student'}.png`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </a>
                )}
                <button
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Pass</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-6 text-slate-500 text-xs">
              No QR identity has been provisioned yet for your account. Please log in or register.
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
