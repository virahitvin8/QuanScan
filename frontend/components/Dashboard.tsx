import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Layers, Package, Calendar, Scan, Star } from 'lucide-react';
import { ScanResult } from '../types';

interface DashboardProps {
  scans: ScanResult[];
}

const CATEGORY_COLORS = ['#00C2A8', '#8C7CFF', '#FF7A59', '#F2A93B', '#2FBF71', '#06b6d4'];

export const Dashboard: React.FC<DashboardProps> = ({ scans }) => {

  const stats = useMemo(() => {
    let totalItems = 0;
    const categories = new Set<string>();
    const itemBreakdown: Record<string, number> = {};
    const categoryBreakdown: Record<string, number> = {};

    scans.forEach(scan => {
      totalItems += scan.totalCount;
      categories.add(scan.detectedCategory);
      categoryBreakdown[scan.detectedCategory] = (categoryBreakdown[scan.detectedCategory] || 0) + scan.totalCount;
      scan.items.forEach(item => {
        itemBreakdown[item.label] = (itemBreakdown[item.label] || 0) + item.count;
      });
    });

    const sortedItems = Object.entries(itemBreakdown).sort((a, b) => b[1] - a[1]);
    const sortedCategories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);

    return {
      totalScans: scans.length,
      totalItems,
      uniqueCategories: categories.size,
      topItem: sortedItems[0]?.[0] || 'N/A',
      topItemCount: sortedItems[0]?.[1] || 0,
      sortedItems: sortedItems.slice(0, 8),
      categoryBreakdown: sortedCategories.map(([name, value]) => ({ name, value })),
    };
  }, [scans]);

  const trendData = useMemo(() => {
    return [...scans]
      .slice(0, 10)
      .reverse()
      .map(scan => ({
        date: new Date(scan.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        count: scan.totalCount,
        name: scan.title.length > 12 ? scan.title.substring(0, 12) + '…' : scan.title,
      }));
  }, [scans]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div
          className="px-3 py-2 rounded-xl text-xs shadow-lg"
          style={{ background: 'white', border: '1px solid #ccfbf1', boxShadow: '0 4px 16px rgba(0,194,168,0.15)' }}
        >
          <p className="text-[#5C7A73] mb-1">{label}</p>
          <p className="font-extrabold text-[#123A34]">
            {payload[0].value} <span style={{ color: '#FF7A59' }}>items</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5 pb-28 animate-fade-in">

      {/* ── STAT CARDS ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Package, label: 'Total Items', value: stats.totalItems, color: '#00C2A8', bg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)' },
          { icon: Scan,    label: 'Total Scans', value: stats.totalScans, color: '#8C7CFF', bg: 'linear-gradient(135deg,#f5f3ff,#edeaff)' },
          { icon: Layers,  label: 'Categories',  value: stats.uniqueCategories, color: '#FF7A59', bg: 'linear-gradient(135deg,#fff5f2,#ffe7df)' },
          { icon: Star,    label: 'Top Item Count', value: stats.topItemCount, color: '#F2A93B', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div
            key={label}
            className="rounded-2xl p-4"
            style={{ background: bg, border: '1px solid', borderColor: color + '30' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#5C7A73]">{label}</span>
            </div>
            <span className="text-3xl font-black text-[#123A34]">{value}</span>
          </div>
        ))}
      </div>

      {/* ── TOP ITEM BANNER ──────────────────────────── */}
      {stats.topItem !== 'N/A' && (
        <div
          className="rounded-2xl px-5 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #00C2A8, #8C7CFF)', boxShadow: '0 4px 20px rgba(0,194,168,0.3)' }}
        >
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/70 mb-1">🏆 Most Counted Item</p>
            <h3 className="text-base font-black text-white">{stats.topItem}</h3>
          </div>
          <div className="text-right">
            <span className="text-4xl font-black text-white">{stats.topItemCount}</span>
            <p className="text-[10px] text-white/70 mt-0.5">total</p>
          </div>
        </div>
      )}

      {scans.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center p-14 rounded-3xl text-center"
          style={{ background: 'white', border: '2px dashed #ccfbf1' }}
        >
          <TrendingUp className="w-10 h-10 mb-3" style={{ color: '#99f6e4' }} />
          <p className="font-bold text-[#123A34] text-sm">No data yet</p>
          <p className="text-xs text-[#5C7A73] mt-1">Complete a scan to see insights here</p>
        </div>
      ) : (
        <>
          {/* ── TREND CHART ──────────────────────────── */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'white', border: '1.5px solid #ccfbf1', boxShadow: '0 4px 16px rgba(0,194,168,0.08)' }}
          >
            <h3 className="text-sm font-extrabold text-[#123A34]">Recent Volume</h3>
            <p className="text-[11px] text-[#5C7A73] mb-4">Items counted across recent scans</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C2A8" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8C7CFF" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0fdfa" vertical={false} />
                  <XAxis dataKey="date" fontSize={9} tickLine={false} axisLine={false} stroke="#5C7A73" />
                  <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="#5C7A73" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke="#00C2A8" strokeWidth={2.5} fillOpacity={1} fill="url(#areaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── CATEGORY BAR CHART ───────────────────── */}
          {stats.categoryBreakdown.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: 'white', border: '1.5px solid #ccfbf1', boxShadow: '0 4px 16px rgba(0,194,168,0.08)' }}
            >
              <h3 className="text-sm font-extrabold text-[#123A34]">Category Distribution</h3>
              <p className="text-[11px] text-[#5C7A73] mb-4">Total items per category</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.categoryBreakdown} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdfa" vertical={false} />
                    <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} stroke="#5C7A73" />
                    <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="#5C7A73" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0fdfa', opacity: 0.5 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
                      {stats.categoryBreakdown.map((_, i) => (
                        <rect key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── ITEM BREAKDOWN LIST ───────────────────── */}
          {stats.sortedItems.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'white', border: '1.5px solid #ccfbf1', boxShadow: '0 4px 16px rgba(0,194,168,0.08)' }}
            >
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #f0fdfa' }}>
                <h3 className="text-sm font-extrabold text-[#123A34]">All Items — Grand Total</h3>
                <p className="text-[11px] text-[#5C7A73]">Cumulative count across all saved scans</p>
              </div>
              <div className="divide-y" style={{ borderColor: '#f0fdfa' }}>
                {stats.sortedItems.map(([label, count], i) => {
                  const pct = Math.round((count / stats.totalItems) * 100);
                  const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                  return (
                    <div key={label} className="px-5 py-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-[#123A34]">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#5C7A73]">{pct}%</span>
                          <span className="text-base font-black" style={{ color: '#FF7A59' }}>{count}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: '#f0fdfa' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
