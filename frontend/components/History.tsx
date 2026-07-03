import React, { useState, useMemo } from 'react';
import { Search, Calendar, Trash2, CheckCircle2, Circle, Layers, X, Package, AlertCircle, Sparkles, RefreshCw, ChevronRight } from 'lucide-react';
import { ScanResult } from '../types';
import { analyzeInventoryImageBatch } from '../services/geminiService';

interface HistoryProps {
  scans: ScanResult[];
  onDeleteScan: (id: string) => void;
  onClearHistory: () => void;
  onBatchScanCompleted: (scan: ScanResult) => void;
}

const CONF_DOT: Record<string, string> = {
  high: '#2FBF71',
  medium: '#F2A93B',
  low: '#ef4444',
};

export const History: React.FC<HistoryProps> = ({ scans, onDeleteScan, onClearHistory, onBatchScanCompleted }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedScanIds, setSelectedScanIds] = useState<Set<string>>(new Set());
  const [activeDetailScan, setActiveDetailScan] = useState<ScanResult | null>(null);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    scans.forEach(s => cats.add(s.detectedCategory));
    return ['All', ...Array.from(cats)];
  }, [scans]);

  const filteredScans = useMemo(() => {
    return scans.filter(scan => {
      const q = searchQuery.toLowerCase();
      const matchSearch = scan.title.toLowerCase().includes(q) || scan.detectedCategory.toLowerCase().includes(q);
      const matchCat = selectedCategory === 'All' || scan.detectedCategory === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [scans, searchQuery, selectedCategory]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedScanIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedScanIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedScanIds.size === filteredScans.length) setSelectedScanIds(new Set());
    else setSelectedScanIds(new Set(filteredScans.map(s => s.id)));
  };

  const aggregated = useMemo(() => {
    const totals: Record<string, number> = {};
    let grand = 0;
    scans.forEach(scan => {
      if (selectedScanIds.has(scan.id)) {
        scan.items.forEach(item => {
          totals[item.label] = (totals[item.label] || 0) + item.count;
          grand += item.count;
        });
      }
    });
    return { breakdown: Object.entries(totals).map(([label, count]) => ({ label, count })), grand };
  }, [scans, selectedScanIds]);

  const handleDeleteSelected = () => {
    if (window.confirm(`Delete ${selectedScanIds.size} selected scan(s)?`)) {
      selectedScanIds.forEach(id => onDeleteScan(id));
      setSelectedScanIds(new Set());
    }
  };

  const handleBatchAnalyze = async () => {
    if (selectedScanIds.size < 2) { alert('Select at least 2 scans to batch analyze.'); return; }
    setIsBatchAnalyzing(true);
    try {
      const sel = scans.filter(s => selectedScanIds.has(s.id));
      const result = await analyzeInventoryImageBatch(sel.map(s => s.imageUrl));
      const combined: ScanResult = {
        id: `scan-${Date.now()}`,
        title: `Combined Batch (${sel.length} Scans)`,
        timestamp: Date.now(),
        imageUrl: sel[0].imageUrl,
        detectedCategory: result.detectedCategory,
        totalCount: result.totalCount,
        items: result.items,
        sceneDescription: result.sceneDescription,
      };
      onBatchScanCompleted(combined);
      setSelectedScanIds(new Set());
      alert('Batch analysis completed and saved to history!');
    } catch {
      alert('Batch analysis failed. Please try again.');
    } finally {
      setIsBatchAnalyzing(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-5 pb-36 animate-fade-in">

      {/* ── SEARCH ───────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#00A389' }} />
        <input
          type="text"
          placeholder="Search scans…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3.5 text-sm rounded-2xl outline-none transition-all"
          style={{
            background: 'white',
            border: '1.5px solid #ccfbf1',
            color: '#123A34',
            boxShadow: '0 2px 8px rgba(0,194,168,0.08)',
          }}
          onFocus={e => (e.target.style.borderColor = '#00C2A8')}
          onBlur={e => (e.target.style.borderColor = '#ccfbf1')}
        />
      </div>

      {/* ── CATEGORY PILLS ───────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all"
            style={
              selectedCategory === cat
                ? { background: 'linear-gradient(135deg, #00C2A8, #8C7CFF)', color: 'white', boxShadow: '0 3px 10px rgba(0,194,168,0.3)' }
                : { background: 'white', color: '#5C7A73', border: '1px solid #ccfbf1' }
            }
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── LIST HEADER ──────────────────────────────── */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-extrabold text-[#123A34]">
          Records <span className="font-normal text-[#5C7A73]">({filteredScans.length})</span>
        </h3>
        <div className="flex items-center gap-3">
          {filteredScans.length > 0 && (
            <button onClick={toggleSelectAll} className="text-xs font-bold" style={{ color: '#00A389' }}>
              {selectedScanIds.size === filteredScans.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {scans.length > 0 && (
            <button onClick={onClearHistory} className="text-xs font-bold" style={{ color: '#ef4444' }}>
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* ── SCAN CARDS ───────────────────────────────── */}
      <div className="space-y-3">
        {filteredScans.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center p-12 rounded-3xl text-center"
            style={{ background: 'white', border: '2px dashed #ccfbf1' }}
          >
            <Package className="w-10 h-10 mb-3" style={{ color: '#99f6e4' }} />
            <p className="font-bold text-[#123A34] text-sm">No records found</p>
            <p className="text-xs text-[#5C7A73] mt-1">Adjust filters or create a new scan</p>
          </div>
        ) : (
          filteredScans.map(scan => {
            const isSelected = selectedScanIds.has(scan.id);
            return (
              <div
                key={scan.id}
                onClick={() => setActiveDetailScan(scan)}
                className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all active:scale-[0.99]"
                style={{
                  background: isSelected ? 'linear-gradient(135deg, #f0fdfa, #edeaff)' : 'white',
                  border: isSelected ? '1.5px solid #00C2A8' : '1.5px solid #e8faf6',
                  boxShadow: '0 2px 8px rgba(0,194,168,0.06)',
                }}
              >
                {/* Checkbox */}
                <button
                  onClick={e => toggleSelect(scan.id, e)}
                  className="shrink-0 transition-colors"
                  style={{ color: isSelected ? '#00C2A8' : '#99f6e4' }}
                >
                  {isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </button>

                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0" style={{ background: '#f0fdfa' }}>
                  <img src={scan.imageUrl} alt={scan.title} className="w-full h-full object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-[#123A34] truncate">{scan.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#f0fdfa', color: '#00A389', border: '1px solid #99f6e4' }}>
                      {scan.detectedCategory}
                    </span>
                    <span className="text-[10px] text-[#5C7A73] flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDate(scan.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Count + chevron */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-2xl font-black" style={{ color: '#FF7A59' }}>{scan.totalCount}</span>
                  <ChevronRight className="w-4 h-4" style={{ color: '#99f6e4' }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── FLOATING MULTI-SELECT BAR ─────────────────── */}
      {selectedScanIds.size > 0 && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[92%] max-w-sm rounded-2xl p-4 z-40 animate-slide-up"
          style={{ background: 'white', border: '1.5px solid #00C2A8', boxShadow: '0 8px 32px rgba(0,194,168,0.25)' }}
        >
          {/* Aggregate totals */}
          {aggregated.breakdown.length > 0 && (
            <div className="mb-3 p-3 rounded-xl" style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#00A389] mb-2">
                Selected Total: <span className="text-[#FF7A59] text-sm">{aggregated.grand}</span> items
              </p>
              <div className="space-y-1">
                {aggregated.breakdown.map(({ label, count }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-[#123A34] font-medium">{label}</span>
                    <span className="font-bold text-[#00A389]">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" style={{ color: '#00C2A8' }} />
              <span className="text-sm font-bold text-[#123A34]">{selectedScanIds.size} Selected</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleBatchAnalyze}
              disabled={isBatchAnalyzing || selectedScanIds.size < 2}
              className="flex-[2] py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00C2A8, #8C7CFF)', boxShadow: '0 3px 10px rgba(0,194,168,0.25)' }}
            >
              {isBatchAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Combine & Analyze
            </button>
            <button
              onClick={handleDeleteSelected}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: '#fff5f2', color: '#ef4444' }}
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedScanIds(new Set())}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: '#f0fdfa', color: '#5C7A73' }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ─────────────────────────────── */}
      {activeDetailScan && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in"
          style={{ background: 'rgba(18,58,52,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setActiveDetailScan(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up flex flex-col"
            style={{ maxHeight: '92vh', border: '1.5px solid #ccfbf1', boxShadow: '0 -8px 48px rgba(0,194,168,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 flex justify-between items-start" style={{ borderBottom: '1px solid #f0fdfa' }}>
              <div>
                <h3 className="text-base font-extrabold text-[#123A34]">{activeDetailScan.title}</h3>
                <p className="text-xs text-[#5C7A73] mt-0.5">{new Date(activeDetailScan.timestamp).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setActiveDetailScan(null)}
                className="p-1.5 rounded-xl transition-colors"
                style={{ background: '#f0fdfa', color: '#5C7A73' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-5 space-y-5 no-scrollbar">
              {/* Image */}
              <div className="relative rounded-2xl overflow-hidden" style={{ background: '#f0fdfa', border: '1px solid #ccfbf1' }}>
                <img src={activeDetailScan.imageUrl} alt={activeDetailScan.title} className="w-full object-contain max-h-56" />
                {activeDetailScan.items.map(item => {
                  if (!item.box_2d) return null;
                  const [ymin, xmin, ymax, xmax] = item.box_2d;
                  return (
                    <div
                      key={item.id}
                      className="absolute border border-[#00C2A8] rounded-sm"
                      style={{ top: `${ymin}%`, left: `${xmin}%`, width: `${xmax - xmin}%`, height: `${ymax - ymin}%`, background: 'rgba(0,194,168,0.15)' }}
                    />
                  );
                })}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #00C2A8, #8C7CFF)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Total Count</p>
                  <span className="text-4xl font-black text-white">{activeDetailScan.totalCount}</span>
                </div>
                <div className="rounded-2xl p-4" style={{ background: '#f0fdfa', border: '1px solid #ccfbf1' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C7A73] mb-1">Category</p>
                  <span className="text-sm font-bold text-[#123A34] block mt-1">{activeDetailScan.detectedCategory}</span>
                </div>
              </div>

              {/* Description */}
              {activeDetailScan.sceneDescription && (
                <div className="p-4 rounded-2xl" style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}>
                  <p className="text-xs text-[#5C7A73] italic">"{activeDetailScan.sceneDescription}"</p>
                </div>
              )}

              {/* Breakdown */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#123A34] mb-3">Item Breakdown</h4>
                <div className="space-y-2">
                  {activeDetailScan.items.map((item, i) => {
                    const conf = item.confidence || 'high';
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3.5 rounded-2xl"
                        style={{ background: '#f0fdfa', border: '1px solid #ccfbf1' }}
                      >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CONF_DOT[conf] }} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-[#123A34]">{item.label}</span>
                          {item.notes && (
                            <p className="text-[10px] text-[#5C7A73] mt-0.5 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <span className="text-lg font-black" style={{ color: '#FF7A59' }}>×{item.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5" style={{ borderTop: '1px solid #f0fdfa' }}>
              <button
                onClick={() => { onDeleteScan(activeDetailScan.id); setActiveDetailScan(null); }}
                className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{ background: '#fff5f2', color: '#ef4444', border: '1px solid #ffe7df' }}
              >
                <Trash2 className="w-4 h-4" />
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
