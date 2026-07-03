import React, { useState, useEffect } from 'react';
import { Logo } from './components/Logo';
import { Scanner } from './components/Scanner';
import { History } from './components/History';
import { Dashboard } from './components/Dashboard';
import { ActiveTab, ScanResult } from './types';
import { ScanLine, List, BarChart2, Zap } from 'lucide-react';

const TABS: { id: ActiveTab; label: string; icon: React.FC<any> }[] = [
  { id: 'scan',      label: 'Scan',     icon: ScanLine  },
  { id: 'history',  label: 'Records',  icon: List      },
  { id: 'dashboard',label: 'Insights', icon: BarChart2 },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scan');
  const [scans, setScans] = useState<ScanResult[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('quanscan_pro_history');
    if (saved) {
      try { setScans(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const persist = (updated: ScanResult[]) => {
    setScans(updated);
    localStorage.setItem('quanscan_pro_history', JSON.stringify(updated));
  };

  const handleScanCompleted = (newScan: ScanResult) => {
    persist([newScan, ...scans]);
    setActiveTab('history');
  };

  const handleDeleteScan = (id: string) => persist(scans.filter(s => s.id !== id));

  const handleClearHistory = () => {
    if (window.confirm('Clear all scan history? This cannot be undone.')) persist([]);
  };

  return (
    <div
      className="min-h-screen flex flex-col max-w-md mx-auto relative"
      style={{
        background: 'linear-gradient(180deg, #f0fdfa 0%, #f5f3ff 50%, #f0fdfa 100%)',
        boxShadow: '0 0 0 1px #ccfbf1, 0 20px 60px rgba(0,194,168,0.08)',
      }}
    >
      {/* ── STATUS BAR SPACER ── */}
      <div className="h-safe-top" />

      {/* ── HEADER ───────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 px-5 py-3.5 flex items-center justify-between"
        style={{
          background: 'rgba(240,253,250,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(204,251,241,0.8)',
        }}
      >
        <Logo size="sm" />

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'white', border: '1px solid #ccfbf1', boxShadow: '0 2px 8px rgba(0,194,168,0.1)' }}
        >
          <Zap className="w-3 h-3" style={{ color: '#00C2A8' }} />
          <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: '#00A389' }}>
            AI Ready
          </span>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00C2A8' }} />
        </div>
      </header>

      {/* ── TAB TITLE ─────────────────────────────────── */}
      <div className="px-5 pt-4 pb-1">
        {activeTab === 'scan' && (
          <div>
            <h2 className="text-2xl font-black text-[#123A34]">Quick Scan</h2>
            <p className="text-xs text-[#5C7A73] mt-0.5">Take a top-down photo to count anything instantly</p>
          </div>
        )}
        {activeTab === 'history' && (
          <div>
            <h2 className="text-2xl font-black text-[#123A34]">Scan Records</h2>
            <p className="text-xs text-[#5C7A73] mt-0.5">
              {scans.length} scan{scans.length !== 1 ? 's' : ''} saved on device
            </p>
          </div>
        )}
        {activeTab === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-black text-[#123A34]">Insights</h2>
            <p className="text-xs text-[#5C7A73] mt-0.5">Cumulative totals across all your scans</p>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────── */}
      <main className="flex-1 px-4 py-4 overflow-y-auto no-scrollbar">
        {activeTab === 'scan' && (
          <Scanner onScanCompleted={handleScanCompleted} />
        )}
        {activeTab === 'history' && (
          <History
            scans={scans}
            onDeleteScan={handleDeleteScan}
            onClearHistory={handleClearHistory}
            onBatchScanCompleted={handleScanCompleted}
          />
        )}
        {activeTab === 'dashboard' && (
          <Dashboard scans={scans} />
        )}
      </main>

      {/* ── FLOATING BOTTOM NAV ───────────────────────── */}
      <nav
        className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-50"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(204,251,241,0.9)',
          borderRadius: 999,
          padding: '6px 8px',
          boxShadow: '0 8px 32px rgba(0,194,168,0.2), 0 2px 8px rgba(0,0,0,0.06)',
          width: 'calc(100% - 40px)',
          maxWidth: 380,
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-full transition-all duration-300"
              style={
                isActive
                  ? {
                      background: 'linear-gradient(135deg, #00C2A8, #8C7CFF)',
                      boxShadow: '0 4px 16px rgba(0,194,168,0.4)',
                      color: 'white',
                    }
                  : { color: '#99a8a4' }
              }
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[9px] font-extrabold tracking-wider uppercase">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default App;
