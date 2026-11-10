import React, { useState } from 'react';
import { BusIdentificationMap } from '../types/index.ts';
import { appAssetUrl, DEFAULT_BUS_MAP_IMAGE } from '../services/assets.ts';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Download, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  Bus as BusIcon, 
  CheckCircle2,
  Info
} from 'lucide-react';

interface BusIdentificationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  busMap: BusIdentificationMap | null;
  role?: string;
  autoOpened?: boolean;
}

export const BusIdentificationMapModal: React.FC<BusIdentificationMapModalProps> = ({
  isOpen,
  onClose,
  busMap,
  role = 'student',
  autoOpened = false
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  if (!isOpen) return null;

  const mapData: BusIdentificationMap = busMap
    ? { ...busMap, image_url: appAssetUrl(busMap.image_url) }
    : {
        id: 'default',
        image_url: appAssetUrl(DEFAULT_BUS_MAP_IMAGE),
        title: 'CIT Campus Bus Identification & Parking Bay Allocation Map',
        effective_date: new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }),
        updated_at: new Date().toISOString(),
        updated_by_name: 'Campus Transport Authenticator',
        updated_by_email: 'transport@citchennai.net',
        notes: 'Official campus parking bay layout and bus identification numbers. Reminder: Route numbers are used as bus numbers.',
        version: 1
      };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.75));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen 
            ? 'fixed inset-2 sm:inset-4 max-w-none max-h-none h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)]' 
            : 'max-w-4xl max-h-[92vh] h-[88vh]'
        }`}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                <MapPin className="w-3 h-3" />
                Bus Identification Map
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Active for Today • Updated Daily
              </span>
              {autoOpened && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <Info className="w-3 h-3" />
                  Mandatory Check on {role === 'driver' ? 'Driver Login' : 'Student Login'}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {mapData.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date: <strong className="text-slate-700">{mapData.effective_date}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Verified by: <strong className="text-slate-700">{mapData.updated_by_name}</strong></span>
              </span>
              <span>•</span>
              <span className="text-blue-600 font-medium">Route No. = Bus No.</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
              title="Close Map"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Operational Notice / Authenticator Note */}
        {mapData.notes && (
          <div className="px-4 py-2.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-3 text-xs text-blue-900 shrink-0">
            <div className="flex items-center gap-2">
              <BusIcon className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong className="font-semibold">Authenticator Instructions:</strong> {mapData.notes}
              </span>
            </div>
            <span className="hidden sm:inline-block text-[11px] text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded font-mono">
              Bay Guide v{mapData.version || 1}
            </span>
          </div>
        )}

        {/* Map Image Viewer Container */}
        <div className="relative flex-1 bg-slate-900 overflow-auto flex items-center justify-center p-2 sm:p-4 select-none">
          {imageError ? (
            <div className="text-center p-8 bg-slate-800 rounded-xl max-w-md border border-slate-700 text-slate-300">
              <MapPin className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white mb-1">Image Loading Fallback</h3>
              <p className="text-xs text-slate-400 mb-4">
                The high-resolution daily bus map is available directly from the campus transport repository.
              </p>
              <a
                href={mapData.image_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
              >
                <span>Open Direct Image URL</span>
              </a>
            </div>
          ) : (
            <div 
              className="transition-transform duration-150 ease-out flex items-center justify-center"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={mapData.image_url}
                alt="CIT Campus Bus Identification and Parking Bay Allocation Map"
                className="max-h-[68vh] sm:max-h-[72vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-700/60"
                onError={() => {
                  console.warn('Failed to load primary bus map image URL, attempting fallback');
                  setImageError(true);
                }}
              />
            </div>
          )}

          {/* Floating Zoom & Action Controls Bar */}
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 p-1.5 bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-700 shadow-xl text-white">
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-1.5 text-slate-300 min-w-10 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 hover:text-white transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-700 mx-0.5" />
            <a
              href={mapData.image_url}
              download="CIT_Bus_Identification_Map.jpg"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-200 hover:text-white transition-colors flex items-center gap-1"
              title="Download Map"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Footer with Acknowledgement / Proceed Button */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              You can reopen this Bus Identification Map anytime from the top navigation bar.
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              <span>I Have Noted the Map • Proceed to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
