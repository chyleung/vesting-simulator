import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Settings, 
  TrendingUp, 
  Users, 
  Calendar, 
  Table as TableIcon,
  BarChart3,
  Info,
  DollarSign,
  Zap,
  Trash2,
  Plus,
  Bookmark,
  Clock,
  Layers
} from 'lucide-react';

const App = () => {
  // --- Global State / Parameters ---
  const [nhAmount, setNhAmount] = useState(100000);
  const [targetPay, setTargetPay] = useState(140000); 
  const [refreshPercentOfNh, setRefreshPercentOfNh] = useState(25); 
  
  // Vesting Frequency
  const [vestingFrequency, setVestingFrequency] = useState('quarterly'); // 'monthly' or 'quarterly'
  
  // Refresh Timing (0 = Jan, 11 = Dec)
  const [refreshMonth, setRefreshMonth] = useState(11); 

  // Vesting Schedules
  const [nhSchedule, setNhSchedule] = useState([25, 25, 25, 25]);
  const [refSchedule, setRefSchedule] = useState([30, 30, 20, 20]); // Years 1-4
  const [refScheduleLate, setRefScheduleLate] = useState([25, 25, 25, 25]); // Years 5-6

  const [proration, setProration] = useState({
    Q1: 100,
    Q2: 75,
    Q3: 50,
    Q4: 25
  });

  // Y1 Refresh Cliff Logic (Months)
  const [cliffSettings, setCliffSettings] = useState({
    Q1: 0,
    Q2: 0,
    Q3: 0,
    Q4: 0
  });

  const [activeTab, setActiveTab] = useState('overview'); 
  const [comparisonYear, setComparisonYear] = useState(1); 

  // --- Scenarios State ---
  const [scenarios, setScenarios] = useState([
    {
      id: 'default',
      name: 'Baseline Model',
      data: { 
        nhAmount: 100000, 
        targetPay: 140000, 
        refreshPercentOfNh: 25, 
        nhSchedule: [25, 25, 25, 25], 
        refSchedule: [30, 30, 20, 20], 
        refScheduleLate: [25, 25, 25, 25],
        proration: { Q1: 100, Q2: 75, Q3: 50, Q4: 25 },
        vestingFrequency: 'quarterly',
        refreshMonth: 11,
        cliffSettings: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
      }
    }
  ]);
  const [newScenarioName, setNewScenarioName] = useState('');

  // --- Constants ---
  const JOINERS = [
    { id: 'Q1', name: 'Feb 1 Joiner', startDate: '2024-02-01', firstVest: '2024-05-01' },
    { id: 'Q2', name: 'May 1 Joiner', startDate: '2024-05-01', firstVest: '2024-08-01' },
    { id: 'Q3', name: 'Aug 1 Joiner', startDate: '2024-08-01', firstVest: '2024-11-01' },
    { id: 'Q4', name: 'Nov 1 Joiner', startDate: '2024-11-01', firstVest: '2025-02-01' },
  ];

  // Month Options
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const months = useMemo(() => {
    const list = [];
    let current = new Date(2024, 0, 1); 
    const end = new Date(2030, 11, 1); 
    while (current <= end) {
      list.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
    return list;
  }, []);

  // Calculate dynamic refresh dates based on selected month
  const refreshDatesList = useMemo(() => {
    // Years 2024 through 2028
    return [2024, 2025, 2026, 2027, 2028].map(year => new Date(year, refreshMonth, 1));
  }, [refreshMonth]);

  // --- Scenario Functions ---
  const saveScenario = () => {
    if (!newScenarioName.trim()) return;
    const newScenario = {
      id: Date.now().toString(),
      name: newScenarioName,
      data: {
        nhAmount,
        targetPay,
        refreshPercentOfNh,
        nhSchedule: [...nhSchedule],
        refSchedule: [...refSchedule],
        refScheduleLate: [...refScheduleLate],
        proration: { ...proration },
        vestingFrequency,
        refreshMonth,
        cliffSettings: { ...cliffSettings }
      }
    };
    setScenarios([...scenarios, newScenario]);
    setNewScenarioName('');
  };

  const applyScenario = (scenario) => {
    setNhAmount(scenario.data.nhAmount);
    setTargetPay(scenario.data.targetPay);
    setRefreshPercentOfNh(scenario.data.refreshPercentOfNh);
    setNhSchedule(scenario.data.nhSchedule);
    setRefSchedule(scenario.data.refSchedule);
    setRefScheduleLate(scenario.data.refScheduleLate || [25, 25, 25, 25]);
    setProration(scenario.data.proration);
    setVestingFrequency(scenario.data.vestingFrequency || 'quarterly');
    setRefreshMonth(scenario.data.refreshMonth !== undefined ? scenario.data.refreshMonth : 11);
    setCliffSettings(scenario.data.cliffSettings || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 });
  };

  const deleteScenario = (id) => {
    setScenarios(scenarios.filter(s => s.id !== id));
  };

  // --- Calculation Engine ---
  const data = useMemo(() => {
    const vestsPerYear = vestingFrequency === 'monthly' ? 12 : 4;
    const monthsPerVest = vestingFrequency === 'monthly' ? 1 : 3;

    return JOINERS.map(joiner => {
      const monthlyVesting = months.map(m => ({
        date: m,
        dateKey: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
        NH: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, total: 0
      }));

      // 1. Calculate New Hire Grant
      const nhFirstVest = new Date(joiner.firstVest);
      let nhStart = new Date(nhFirstVest);
      if (vestingFrequency === 'monthly') {
        nhStart = new Date(joiner.startDate);
        nhStart.setMonth(nhStart.getMonth() + 1);
      }

      for (let y = 0; y < 4; y++) {
        const annualAmount = nhAmount * (nhSchedule[y] / 100);
        const vestAmount = annualAmount / vestsPerYear;
        
        for (let v = 0; v < vestsPerYear; v++) {
          const vestDate = new Date(nhStart);
          vestDate.setMonth(nhStart.getMonth() + (y * 12) + (v * monthsPerVest));
          
          const mIdx = monthlyVesting.findIndex(mv => mv.dateKey === `${vestDate.getFullYear()}-${String(vestDate.getMonth() + 1).padStart(2, '0')}`);
          if (mIdx !== -1) {
            monthlyVesting[mIdx].NH += vestAmount;
            monthlyVesting[mIdx].total += vestAmount;
          }
        }
      }

      // 2. Calculate Refresh Grants
      refreshDatesList.forEach((grantDate, rIdx) => {
        const rKey = `R${rIdx + 1}`;
        // Standard first vest is grant date + interval
        const firstVestDate = new Date(grantDate);
        firstVestDate.setMonth(grantDate.getMonth() + monthsPerVest); 
        
        // --- Gap Calculation Window ---
        const windowStart = new Date(firstVestDate);
        const windowEnd = new Date(windowStart);
        windowEnd.setMonth(windowEnd.getMonth() + 11);

        let projectedVestingInWindow = 0;
        monthlyVesting.forEach(mv => {
          const d = new Date(mv.date);
          if (d >= windowStart && d <= windowEnd) projectedVestingInWindow += mv.total;
        });

        const baseRefreshAmount = nhAmount * (refreshPercentOfNh / 100);
        const annualGap = Math.max(0, targetPay - projectedVestingInWindow);
        
        // Determine which schedule to use for Gap Sizing logic
        // Use Year 1 of the schedule for sizing
        const activeSchedule = rIdx >= 3 ? refScheduleLate : refSchedule;
        const gapGrantSize = activeSchedule[0] > 0 ? annualGap / (activeSchedule[0] / 100) : 0;
        
        let finalGrantSize = Math.max(baseRefreshAmount, gapGrantSize);

        if (rIdx === 0) finalGrantSize *= (proration[joiner.id] / 100);

        // Cliff Logic Setup for R1
        const cliffMonths = (rIdx === 0) ? cliffSettings[joiner.id] : 0;
        const cliffDate = new Date(grantDate); 
        cliffDate.setMonth(grantDate.getMonth() + cliffMonths);

        for (let y = 0; y < 4; y++) {
          const annualAmount = finalGrantSize * (activeSchedule[y] / 100);
          const vestAmount = annualAmount / vestsPerYear;
          
          for (let v = 0; v < vestsPerYear; v++) {
            let vestDate = new Date(firstVestDate);
            vestDate.setMonth(firstVestDate.getMonth() + (y * 12) + (v * monthsPerVest));
            
            // Apply Cliff Logic for R1
            if (rIdx === 0 && cliffMonths > 0) {
              if (vestDate < cliffDate) {
                vestDate = cliffDate; // Push to cliff date
              }
            }

            const mIdx = monthlyVesting.findIndex(mv => mv.dateKey === `${vestDate.getFullYear()}-${String(vestDate.getMonth() + 1).padStart(2, '0')}`);
            if (mIdx !== -1) {
              monthlyVesting[mIdx][rKey] += vestAmount;
              monthlyVesting[mIdx].total += vestAmount;
            }
          }
        }
      });

      // Tenure Year Stats (Y1-Y6)
      const tenureYearStats = [1, 2, 3, 4, 5, 6].map(year => {
        const hireMonthIndex = months.findIndex(m => {
          const sd = new Date(joiner.startDate);
          return m.getFullYear() === sd.getFullYear() && m.getMonth() === sd.getMonth();
        });
        const startIdx = hireMonthIndex + 1 + (year - 1) * 12;
        let stats = { name: `Y${year}`, NH: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, total: 0 };
        for (let i = 0; i < 12; i++) {
          const currentIdx = startIdx + i;
          const monthData = monthlyVesting[currentIdx];
          if (monthData) {
            stats.NH += monthData.NH; 
            stats.R1 += monthData.R1; 
            stats.R2 += monthData.R2; 
            stats.R3 += monthData.R3; 
            stats.R4 += (monthData.R4 || 0); 
            stats.R5 += (monthData.R5 || 0);
            stats.total += monthData.total;
          }
        }
        return stats;
      });

      return { ...joiner, monthlyVesting, tenureYearStats, tenureY1: tenureYearStats[0].total, tenureY2: tenureYearStats[1].total };
    });
  }, [nhAmount, targetPay, refreshPercentOfNh, nhSchedule, refSchedule, refScheduleLate, proration, months, vestingFrequency, cliffSettings, refreshDatesList]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-indigo-600 p-2 rounded-lg text-white">
                <BarChart3 size={24} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Vesting Simulator</h1>
            </div>
            <p className="text-slate-500 font-medium">Scenario Modelling for Various LTI Vesting Schedules</p>
          </div>
          
          <div className="flex bg-white rounded-xl shadow-sm p-1.5 border border-slate-200">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'table', label: 'Monthly Table', icon: TableIcon }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar: Global Config */}
          <aside className="lg:col-span-1 space-y-6">
            
            {/* Scenarios Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4 text-indigo-600 font-bold uppercase tracking-wider text-xs">
                <Bookmark size={16} />
                <span>Saved Scenarios</span>
              </div>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                {scenarios.map(s => (
                  <div key={s.id} className="flex items-center justify-between group p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                    <button 
                      onClick={() => applyScenario(s)}
                      className="text-xs font-bold text-slate-700 text-left flex-1 truncate mr-2"
                    >
                      {s.name}
                    </button>
                    <button 
                      onClick={() => deleteScenario(s.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Scenario name..." 
                  value={newScenarioName}
                  onChange={e => setNewScenarioName(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                <button 
                  onClick={saveScenario}
                  className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6 text-indigo-600 font-bold uppercase tracking-wider text-xs">
                <Settings size={16} />
                <span>Global Inputs</span>
              </div>
              
              <div className="space-y-5">
                {/* Vesting Frequency Toggle */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Vesting Frequency</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setVestingFrequency('monthly')}
                      className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${vestingFrequency === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      <Clock size={12} /> Monthly
                    </button>
                    <button
                      onClick={() => setVestingFrequency('quarterly')}
                      className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${vestingFrequency === 'quarterly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      <Layers size={12} /> Quarterly
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Target Annual LTI</label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" size={14} />
                    <input type="number" value={targetPay} onChange={e => setTargetPay(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">New Hire Grant Value</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input type="number" value={nhAmount} onChange={e => setNhAmount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Refresh Size (%)</label>
                  <div className="flex items-center gap-3">
                    <input type="number" value={refreshPercentOfNh} onChange={e => setRefreshPercentOfNh(Number(e.target.value))} className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                    <span className="text-[10px] text-slate-500 font-medium">of New Hire Grant</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Refresh Issuance Month</label>
                  <select 
                    value={refreshMonth}
                    onChange={e => setRefreshMonth(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4 text-indigo-600 font-bold text-xs uppercase tracking-wider">
                  <TrendingUp size={16} />
                  <span>Vesting Schedules (%)</span>
                </div>
                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block mb-3">New Hire (Years 1-4)</span>
                    <div className="grid grid-cols-4 gap-2">
                      {nhSchedule.map((val, i) => (
                        <input key={i} type="number" value={val} onChange={e => { const newS = [...nhSchedule]; newS[i] = Number(e.target.value); setNhSchedule(newS); }} className="bg-slate-50 border border-slate-200 text-center font-bold rounded-lg py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"/>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block mb-3">Refreshes (Years 1-3)</span>
                    <div className="grid grid-cols-4 gap-2">
                      {refSchedule.map((val, i) => (
                        <input key={i} type="number" value={val} onChange={e => { const newS = [...refSchedule]; newS[i] = Number(e.target.value); setRefSchedule(newS); }} className="bg-slate-50 border border-slate-200 text-center font-bold rounded-lg py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"/>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block mb-3">Refreshes (Years 4+)</span>
                    <div className="grid grid-cols-4 gap-2">
                      {refScheduleLate.map((val, i) => (
                        <input key={i} type="number" value={val} onChange={e => { const newS = [...refScheduleLate]; newS[i] = Number(e.target.value); setRefScheduleLate(newS); }} className="bg-slate-50 border border-slate-200 text-center font-bold rounded-lg py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"/>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4 text-indigo-600 font-bold text-xs uppercase tracking-wider">
                  <Calendar size={16} />
                  <span>Y1 Refresh Proration Logic</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.keys(proration).map(q => (
                    <div key={q}>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{q} Joiner</label>
                      <div className="relative">
                        <input type="number" value={proration[q]} onChange={e => setProration({...proration, [q]: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-6 py-2 text-xs font-bold" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4 text-indigo-600 font-bold text-xs uppercase tracking-wider">
                  <Clock size={16} />
                  <span>Y1 Refresh Cliff Logic (Months)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.keys(cliffSettings).map(q => (
                    <div key={q}>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">{q} Joiner Cliff</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={cliffSettings[q]} 
                          onChange={e => setCliffSettings({...cliffSettings, [q]: Number(e.target.value)})} 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-6 py-2 text-xs font-bold" 
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">Mo</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
            
            <div className="bg-indigo-600 p-5 rounded-2xl text-white shadow-lg shadow-indigo-200 relative overflow-hidden group">
              <div className="relative z-10">
                <h4 className="font-bold mb-2 flex items-center gap-2"><Info size={16} /> Logic Rule</h4>
                <p className="text-xs text-indigo-100 leading-relaxed">
                  Refreshes are the greater of <strong>{refreshPercentOfNh}% of NH</strong> or <strong>the gap to target pay</strong> in the upcoming year.
                </p>
              </div>
              <div className="absolute -right-4 -bottom-4 bg-indigo-500 w-24 h-24 rounded-full opacity-50" />
            </div>
          </aside>

          {/* Main Workspace */}
          <main className="lg:col-span-3 space-y-8">
            {activeTab === 'overview' && (
              <div className="space-y-10">
                <section className="space-y-6">
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-bold flex items-center gap-2 px-2">
                      <Users size={20} className="text-indigo-600" />
                      Comparison of Year {comparisonYear} Vesting by Hired Month
                    </h2>
                    <div className="flex p-1 bg-slate-100 rounded-xl">
                      {[1, 2].map(yr => (
                        <button key={yr} onClick={() => setComparisonYear(yr)} className={`px-6 py-1.5 text-xs font-bold rounded-lg transition-all ${comparisonYear === yr ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Year {yr}</button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.map(joiner => (
                      <div key={joiner.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-400 transition-all group">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h3 className="text-xl font-extrabold text-slate-800">{joiner.name}</h3>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Join: {new Date(joiner.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-3xl font-black text-indigo-600 tracking-tight">{formatCurrency(comparisonYear === 1 ? joiner.tenureY1 : joiner.tenureY2)}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50 relative">
                            <div className="h-full bg-indigo-600 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(79,70,229,0.3)]" style={{ width: `${Math.min(100, ((comparisonYear === 1 ? joiner.tenureY1 : joiner.tenureY2) / targetPay) * 100)}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 font-black uppercase tracking-widest pt-1">
                            <span>vs Target ({formatCurrency(targetPay)})</span>
                            <span className={`${(comparisonYear === 1 ? joiner.tenureY1 : joiner.tenureY2) >= targetPay ? 'text-emerald-500' : 'text-amber-500'}`}>{Math.round(((comparisonYear === 1 ? joiner.tenureY1 : joiner.tenureY2) / targetPay) * 100)}% of Target</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {data.map(joiner => (
                    <div key={joiner.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-start mb-6">
                        <h3 className="text-lg font-black text-slate-800">{joiner.name} YOY Vest</h3>
                        <div className="text-[9px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-slate-200">Total: {formatCurrency(joiner.tenureYearStats.reduce((acc, curr) => acc + curr.total, 0))}</div>
                      </div>
                      <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={joiner.tenureYearStats} barSize={35}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} fontWeight="bold" tick={{ fill: '#64748b' }} />
                            <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight="bold" tickFormatter={(v) => `$${v / 1000}K`} tick={{ fill: '#94a3b8' }} />
                            <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-800">
                                    <p className="text-[10px] font-black uppercase mb-2 border-b border-slate-700 pb-1">{label} Detail</p>
                                    {payload.map((p, idx) => (
                                      <div key={idx} className="flex justify-between gap-4 py-0.5"><span className="text-[9px] font-bold text-slate-400">{p.name}:</span><span className="text-[9px] font-mono font-bold text-white">{formatCurrency(p.value)}</span></div>
                                    ))}
                                    <div className="mt-1 pt-1 border-t border-slate-700 flex justify-between"><span className="text-[9px] font-black">Total:</span><span className="text-[9px] font-black text-indigo-400">{formatCurrency(payload.reduce((s, p) => s + p.value, 0))}</span></div>
                                  </div>
                                );
                              }
                              return null;
                            }} />
                            <Legend iconType="rect" iconSize={12} wrapperStyle={{ paddingTop: '15px', fontSize: '10px', fontWeight: 'bold' }} />
                            <Bar dataKey="NH" name="Extension" stackId="a" fill="#4f86f7" />
                            <Bar dataKey="R1" name="Y1 Refresh" stackId="a" fill="#e55347" />
                            <Bar dataKey="R2" name="Y2 Refresh" stackId="a" fill="#f6c244" />
                            <Bar dataKey="R3" name="Y3 Refresh" stackId="a" fill="#5cb35c" />
                            <Bar dataKey="R4" name="Y4 Refresh" stackId="a" fill="#9333ea" />
                            <Bar dataKey="R5" name="Y5 Refresh" stackId="a" fill="#06b6d4" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </section>
              </div>
            )}

            {activeTab === 'table' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center"><h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Monthly Cash Flow Matrix</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="p-4 text-[10px] font-black uppercase text-slate-400 whitespace-nowrap sticky left-0 bg-white z-20 border-r border-slate-100">Month</th>
                        {JOINERS.map(j => ( <th key={j.id} className="p-4 text-[10px] font-black uppercase text-slate-600 text-center border-r border-slate-50 min-w-[140px]">{j.name}</th> ))}
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m, idx) => {
                        const dateKey = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
                        return (
                          <tr key={dateKey} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors group">
                            <td className="p-4 text-[11px] font-black text-slate-500 sticky left-0 bg-white z-20 border-r border-slate-100 group-hover:bg-indigo-50/30 transition-colors">{m.toLocaleString('default', { month: 'short', year: 'numeric' })}</td>
                            {data.map(j => {
                              const v = j.monthlyVesting[idx];
                              return (
                                <td key={j.id} className="p-4 text-center border-r border-slate-50 relative">
                                  {v.total > 0 ? (
                                    <div className="inline-block relative group/cell">
                                      <span className="text-xs font-black text-slate-800 font-mono">{formatCurrency(v.total)}</span>
                                      <div className="invisible group-hover/cell:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-slate-900 text-white p-3 rounded-xl shadow-2xl z-30">
                                        <div className="space-y-1 text-left">
                                          {v.NH > 0 && <div className="flex justify-between text-[9px] gap-4"><span>Extension:</span> <span>{formatCurrency(v.NH)}</span></div>}
                                          {v.R1 > 0 && <div className="flex justify-between text-[9px] gap-4"><span>R1 (2024):</span> <span>{formatCurrency(v.R1)}</span></div>}
                                          {v.R2 > 0 && <div className="flex justify-between text-[9px] gap-4"><span>R2 (2025):</span> <span>{formatCurrency(v.R2)}</span></div>}
                                          {v.R3 > 0 && <div className="flex justify-between text-[9px] gap-4"><span>R3 (2026):</span> <span>{formatCurrency(v.R3)}</span></div>}
                                          {v.R4 > 0 && <div className="flex justify-between text-[9px] gap-4"><span>R4 (2027):</span> <span>{formatCurrency(v.R4)}</span></div>}
                                          {v.R5 > 0 && <div className="flex justify-between text-[9px] gap-4"><span>R5 (2028):</span> <span>{formatCurrency(v.R5)}</span></div>}
                                        </div>
                                      </div>
                                    </div>
                                  ) : ( <span className="text-slate-200 text-[9px] font-bold">—</span> )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;