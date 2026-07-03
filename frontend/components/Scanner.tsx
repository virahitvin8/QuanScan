import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, RefreshCw, Check, AlertCircle, Sparkles, X, Info, Crosshair } from 'lucide-react';
import { analyzeInventoryImage } from '../services/geminiService';
import { ScanResult, DetectedItem } from '../types';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

interface ScannerProps {
  onScanCompleted: (scan: ScanResult) => void;
}

const CONFIDENCE_BORDER: Record<string, string> = {
  high: 'border-emerald-400 bg-emerald-400/15',
  medium: 'border-amber-400 bg-amber-400/15',
  low: 'border-rose-400 bg-rose-400/15',
};

const CONFIDENCE_TAG: Record<string, string> = {
  high: 'bg-emerald-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-rose-500 text-white',
};

interface GroupedItem {
  label: string;
  count: number;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

const getGroupedItems = (items: DetectedItem[]): GroupedItem[] => {
  const groups: { [key: string]: { count: number; confs: string[]; notes: string[] } } = {};
  items.forEach(item => {
    const label = item.label;
    if (!groups[label]) {
      groups[label] = { count: 0, confs: [], notes: [] };
    }
    groups[label].count += item.count || 1;
    if (item.confidence) {
      groups[label].confs.push(item.confidence);
    }
    if (item.notes) {
      groups[label].notes.push(item.notes);
    }
  });

  return Object.keys(groups).map(label => {
    const confs = groups[label].confs;
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (confs.includes('low')) {
      confidence = 'low';
    } else if (confs.includes('medium')) {
      confidence = 'medium';
    }
    const notes = Array.from(new Set(groups[label].notes.filter(Boolean))).join(', ');
    return {
      label,
      count: groups[label].count,
      confidence,
      notes: notes || undefined
    };
  });
};

export const Scanner: React.FC<ScannerProps> = ({ onScanCompleted }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryHint, setCategoryHint] = useState('');
  const [scanTitle, setScanTitle] = useState('');
  const [scanResult, setScanResult] = useState<{
    sceneDescription: string;
    detectedCategory: string;
    totalCount: number;
    items: DetectedItem[];
  } | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
  }, []);

  const startCamera = async () => {
    setError(null);
    setScanResult(null);
    setIsCameraActive(false);

    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera
        });
        if (image && image.dataUrl) {
          setImageSrc(image.dataUrl);
        }
      } catch (err: any) {
        // Only set error if it's not the user canceling the native view
        if (err.message && !err.message.includes('cancelled') && !err.message.includes('canceled')) {
          setError(`Native camera failed: ${err.message}`);
        }
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported on this device. Please upload an image.');
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(e => {
            setError('Could not start camera preview.');
            console.error(e);
          });
        }
      }, 120);
    } catch (err: any) {
      setError(`Camera access denied: ${err.message}. Please upload an image instead.`);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, w, h);
      try {
        setImageSrc(canvas.toDataURL('image/jpeg', 0.92));
        stopCamera();
      } catch (e) {
        setError('Failed to capture image.');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setScanResult(null);
    const reader = new FileReader();
    reader.onloadend = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  const triggerScan = async () => {
    if (!imageSrc) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzeInventoryImage(imageSrc, categoryHint);
      setScanResult(result);
    } catch (err: any) {
      console.error(err);
      setError('AI analysis encountered an issue. Please try again with a clear, well-lit photo.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveScan = () => {
    if (!imageSrc || !scanResult) return;
    const finalTitle = scanTitle.trim() || `${scanResult.detectedCategory} — ${new Date().toLocaleDateString()}`;
    const newScan: ScanResult = {
      id: `scan-${Date.now()}`,
      title: finalTitle,
      timestamp: Date.now(),
      imageUrl: imageSrc,
      detectedCategory: scanResult.detectedCategory,
      totalCount: scanResult.totalCount,
      items: scanResult.items,
      sceneDescription: scanResult.sceneDescription,
      notes: categoryHint ? `Hint: ${categoryHint}` : undefined,
    };
    onScanCompleted(newScan);
    reset();
  };

  const reset = () => {
    setImageSrc(null);
    setScanResult(null);
    setError(null);
    setScanTitle('');
    setCategoryHint('');
    stopCamera();
  };

  return (
    <div className="space-y-5 pb-32 animate-fade-in">
      {/* Live Camera (Full Screen Overlay) */}
      {isCameraActive && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col justify-between">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline muted autoPlay
          />
          {/* Overlay */}
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* dark edges */}
            <div className="absolute inset-0 bg-black/40" />
            {/* Center clear zone */}
            <div
              className="absolute"
              style={{ top: '22%', left: '8%', right: '8%', bottom: '26%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', borderRadius: 24 }}
            />
            {/* Corner brackets */}
            {[
              'top-[22%] left-[8%] border-t-4 border-l-4 rounded-tl-2xl',
              'top-[22%] right-[8%] border-t-4 border-r-4 rounded-tr-2xl',
              'bottom-[26%] left-[8%] border-b-4 border-l-4 rounded-bl-2xl',
              'bottom-[26%] right-[8%] border-b-4 border-r-4 rounded-br-2xl',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-10 h-10 border-[#00C2A8] ${cls}`} />
            ))}
            {/* Scan laser line */}
            <div
              className="absolute left-[8%] right-[8%] h-[3px] animate-scan-line"
              style={{
                top: '22%',
                background: 'linear-gradient(to right, transparent, #00C2A8, #FF7A59, #00C2A8, transparent)',
                boxShadow: '0 0 16px #00C2A8',
              }}
            />
            {/* Tip */}
            <div
              className="absolute bottom-[28%] left-1/2 -translate-x-1/2 px-5 py-2.5 text-white text-xs font-bold rounded-full backdrop-blur-md"
              style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}
            >
              📸 Hold phone directly above tray/box
            </div>
          </div>
          {/* Camera controls */}
          <div className="absolute bottom-10 inset-x-0 flex justify-center items-center gap-10 z-20">
            <button
              onClick={stopCamera}
              className="w-14 h-14 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              style={{ background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(12px)' }}
            >
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={capturePhoto}
              className="w-24 h-24 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'white', border: '5px solid #00C2A8', boxShadow: '0 0 32px rgba(0,194,168,0.6)' }}
            >
              <div style={{ width: '4rem', height: '4rem', borderRadius: '9999px', background: 'linear-gradient(135deg, #00C2A8, #8C7CFF)' }} />
            </button>
            <div className="w-14" /> {/* Spacer to balance Close button */}
          </div>
        </div>
      )}

      {/* ── HERO VIEWPORT ─────────────────────────────── */}
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl"
        style={{
          minHeight: 400,
          background: 'linear-gradient(135deg, #f0fdfa 0%, #edeaff 100%)',
          border: '1.5px solid #ccfbf1',
        }}
      >

        {/* Captured Image + Bounding Boxes */}
        {imageSrc && !isCameraActive && (
          <div className="relative w-full flex flex-col items-center justify-center">
            <div className="relative w-full" style={{ maxHeight: 480, overflow: 'hidden' }}>
              <img src={imageSrc} alt="Scan source" className="w-full object-contain" style={{ maxHeight: 480 }} />

              {/* Bounding Boxes */}
              {scanResult?.items.map(item => {
                if (!item.box_2d) return null;
                const [ymin, xmin, ymax, xmax] = item.box_2d;
                const conf = item.confidence || 'high';
                const isHov = hoveredItemId === item.id || hoveredLabel === item.label;
                return (
                  <div
                    key={item.id}
                    className={`absolute border-2 rounded-sm cursor-pointer transition-all duration-150 ${CONFIDENCE_BORDER[conf]} ${isHov ? 'z-30 scale-[1.015] shadow-lg' : 'z-20'}`}
                    style={{ top: `${ymin}%`, left: `${xmin}%`, width: `${xmax - xmin}%`, height: `${ymax - ymin}%` }}
                    onMouseEnter={() => setHoveredItemId(item.id)}
                    onMouseLeave={() => setHoveredItemId(null)}
                    onTouchStart={() => setHoveredItemId(isHov ? null : item.id)}
                  >
                    {isHov && (
                      <span
                        className={`absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-1 text-[10px] font-bold rounded-lg whitespace-nowrap shadow-xl ${CONFIDENCE_TAG[conf]}`}
                      >
                        {item.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scan laser overlay while loading */}
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-50" style={{ background: 'rgba(243,251,248,0.85)', backdropFilter: 'blur(8px)' }}>
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    className="absolute left-0 right-0 h-[3px] animate-scan-line"
                    style={{ background: 'linear-gradient(to right, transparent, #00C2A8, #FF7A59, #00C2A8, transparent)', boxShadow: '0 0 18px #00C2A8' }}
                  />
                </div>
                <div
                  className="relative bg-white rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl"
                  style={{ border: '1px solid #ccfbf1', maxWidth: 280 }}
                >
                  <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#00C2A8' }} />
                  <span className="text-sm font-bold text-[#123A34]">Quan Scan AI is counting…</span>
                  <p className="text-xs text-center" style={{ color: '#5C7A73' }}>
                    Detecting each item, including overlapping & stacked ones
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!imageSrc && !isCameraActive && (
          <div className="flex flex-col items-center justify-center p-10 text-center" style={{ minHeight: 400 }}>
            {/* Animated scanner icon */}
            <div
              className="relative w-28 h-28 rounded-3xl flex items-center justify-center mb-6"
              style={{
                background: 'linear-gradient(135deg, #e0fdf4, #edeaff)',
                border: '2px dashed #00C2A8',
              }}
            >
              <Crosshair className="w-14 h-14" style={{ color: '#00C2A8', opacity: 0.7 }} />
              <div
                className="absolute inset-x-4 h-[2px] animate-scan-line"
                style={{
                  top: '50%',
                  background: 'linear-gradient(to right, transparent, #00C2A8, #FF7A59, #00C2A8, transparent)',
                  boxShadow: '0 0 8px #00C2A8',
                }}
              />
            </div>

            <h3 className="text-xl font-extrabold text-[#123A34] mb-2">Start Counting</h3>
            <p className="text-sm text-[#5C7A73] leading-relaxed max-w-xs mb-8">
              Take a top-down photo of milk trays, curd packets, vegetables, chocolates, store shelves — <span className="font-semibold text-[#00A389]">AI counts everything instantly.</span>
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-white text-base transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #00C2A8, #8C7CFF)', boxShadow: '0 6px 24px rgba(0,194,168,0.35)' }}
              >
                <Camera className="w-5 h-5" />
                Open Live Camera
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold text-base transition-all active:scale-95"
                style={{
                  background: 'white',
                  color: '#00A389',
                  border: '1.5px solid #99f6e4',
                  boxShadow: '0 2px 8px rgba(0,194,168,0.12)',
                }}
              >
                <Upload className="w-5 h-5" />
                Upload from Gallery
              </button>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
          </div>
        )}
      </div>

      {/* ── ERROR BANNER ─────────────────────────────── */}
      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl animate-slide-up"
          style={{ background: '#fff5f2', border: '1px solid #ffe7df', color: '#ea580c' }}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* ── PRE-SCAN CONFIG ───────────────────────────── */}
      {imageSrc && !isCameraActive && !scanResult && !isLoading && (
        <div
          className="rounded-3xl p-6 space-y-5 animate-slide-up"
          style={{ background: 'white', border: '1.5px solid #ccfbf1', boxShadow: '0 4px 20px rgba(0,194,168,0.08)' }}
        >
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-widest text-[#123A34] mb-2">
              Item / Category Hint <span className="font-normal text-[#5C7A73] normal-case">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Milk Packets, Vegetables, Chocolates…"
              value={categoryHint}
              onChange={e => setCategoryHint(e.target.value)}
              className="w-full rounded-xl px-4 py-3.5 text-sm transition-all outline-none"
              style={{
                background: '#f0fdfa',
                border: '1.5px solid #99f6e4',
                color: '#123A34',
              }}
              onFocus={e => (e.target.style.borderColor = '#00C2A8')}
              onBlur={e => (e.target.style.borderColor = '#99f6e4')}
            />
            <div className="flex items-start gap-1.5 mt-2">
              <Info className="w-3.5 h-3.5 text-[#00A389] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#5C7A73] leading-relaxed">
                Adding a hint helps the AI focus on specific items and improve accuracy.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="px-5 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
              style={{ background: '#f0fdfa', color: '#123A34', border: '1px solid #ccfbf1' }}
            >
              Cancel
            </button>
            <button
              onClick={triggerScan}
              className="flex-1 py-3.5 rounded-xl font-extrabold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #00C2A8, #8C7CFF)', boxShadow: '0 4px 16px rgba(0,194,168,0.3)' }}
            >
              <Sparkles className="w-4 h-4" />
              Analyze & Count Now
            </button>
          </div>
        </div>
      )}

      {/* ── RESULTS ───────────────────────────────────── */}
      {scanResult && !isLoading && (
        <div className="space-y-4 animate-slide-up">

          {/* Summary card */}
          <div
            className="rounded-3xl p-6 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, #00C2A8, #8C7CFF)', boxShadow: '0 8px 32px rgba(0,194,168,0.35)' }}
          >
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-white/70 mb-1">Category</p>
              <h2 className="text-xl font-black text-white leading-tight">{scanResult.detectedCategory}</h2>
              {scanResult.sceneDescription && (
                <p className="text-xs text-white/75 mt-1.5 italic leading-relaxed">{scanResult.sceneDescription}</p>
              )}
            </div>
            <div className="text-right shrink-0 ml-4">
              <span className="text-6xl font-black text-white leading-none">{scanResult.totalCount}</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-1">Total Items</p>
            </div>
          </div>

          {/* Box tip */}
          <div
            className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}
          >
            <Info className="w-4 h-4 shrink-0" style={{ color: '#00A389' }} />
            <p className="text-xs text-[#5C7A73]">
              Tap or hover the colored boxes on the photo above to see item labels.
            </p>
          </div>

          {/* Item breakdown */}
          <div
            className="rounded-3xl overflow-hidden"
            style={{ background: 'white', border: '1.5px solid #ccfbf1', boxShadow: '0 4px 20px rgba(0,194,168,0.08)' }}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: '#f0fdfa' }}>
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#123A34]">Item Breakdown</h4>
            </div>
            <div className="divide-y" style={{ divideColor: '#f0fdfa' }}>
              {getGroupedItems(scanResult.items).map((item, i) => {
                const conf = item.confidence || 'high';
                return (
                  <div
                    key={i}
                    className="flex items-center px-5 py-4 gap-4 cursor-pointer transition-colors hover:bg-[#f0fdfa]"
                    onMouseEnter={() => setHoveredLabel(item.label)}
                    onMouseLeave={() => setHoveredLabel(null)}
                  >
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${CONFIDENCE_TAG[conf]}`}>
                      {conf}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-[#123A34]">{item.label}</span>
                    <span className="text-xl font-black text-[#FF7A59]">×{item.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save form */}
          <div
            className="rounded-3xl p-5 space-y-4"
            style={{ background: 'white', border: '1.5px solid #ccfbf1', boxShadow: '0 4px 20px rgba(0,194,168,0.08)' }}
          >
            <label className="block text-xs font-extrabold uppercase tracking-widest text-[#123A34] mb-2">
              Save Record As
            </label>
            <input
              type="text"
              placeholder="e.g. Morning Delivery Tray 1"
              value={scanTitle}
              onChange={e => setScanTitle(e.target.value)}
              className="w-full rounded-xl px-4 py-3.5 text-sm outline-none transition-all"
              style={{ background: '#f0fdfa', border: '1.5px solid #99f6e4', color: '#123A34' }}
              onFocus={e => (e.target.style.borderColor = '#00C2A8')}
              onBlur={e => (e.target.style.borderColor = '#99f6e4')}
            />
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-5 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                style={{ background: '#fff5f2', color: '#ea580c', border: '1px solid #ffe7df' }}
              >
                Discard
              </button>
              <button
                onClick={saveScan}
                className="flex-1 py-3.5 rounded-xl font-extrabold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #00C2A8, #8C7CFF)', boxShadow: '0 4px 16px rgba(0,194,168,0.3)' }}
              >
                <Check className="w-4 h-4" />
                Save to History
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
