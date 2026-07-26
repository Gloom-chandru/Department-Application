import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, AlertTriangle, Info, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Layers } from 'lucide-react';
import api from '../utils/api';

export default function AcademicHealthCard({ studentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchRiskProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const endpoint = studentId ? `/risk/admin/student/${studentId}` : '/risk/student/me';
      const res = await api.get(endpoint);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching academic health:', err);
      setError('Unable to load academic health summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskProfile();
  }, [studentId]);

  if (loading) {
    return (
      <div className="backdrop-blur-md bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex items-center justify-center space-x-3 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
        <span className="text-sm font-medium">Analyzing academic health & attendance metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const { riskScore, riskLevel, dataCompleteness, confidenceLevel, attendanceScore, marksScore, assignmentScore, progressionScore, factors = [], recommendations = [] } = data;

  const getLevelBadge = (level) => {
    switch (level) {
      case 'HIGH':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          label: 'High Attention Required',
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          label: 'Moderate Attention',
          icon: <Info className="w-4 h-4 text-amber-400" />,
        };
      default:
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          label: 'Good Standing',
          icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
        };
    }
  };

  const badge = getLevelBadge(riskLevel);

  return (
    <div className="backdrop-blur-md bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Academic Health & Early Warning Summary</h3>
            <p className="text-xs text-slate-400">Real-time explainable insights on attendance, marks, and assignments.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${badge.bg}`}>
            {badge.icon}
            <span>{badge.label}</span>
          </div>

          <div className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800/60 border border-slate-700/60 text-slate-300 rounded-lg text-[11px]">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Confidence: <strong>{confidenceLevel}</strong> ({dataCompleteness}%)</span>
          </div>
        </div>
      </div>

      {/* Progress Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Attendance Component */}
        <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Attendance Risk</span>
            <span className="font-bold text-slate-200">{attendanceScore.toFixed(0)} / 100</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${attendanceScore >= 65 ? 'bg-rose-500' : attendanceScore >= 35 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, attendanceScore)}%` }}
            />
          </div>
        </div>

        {/* Marks Component */}
        <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Marks Risk</span>
            <span className="font-bold text-slate-200">{marksScore.toFixed(0)} / 100</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${marksScore >= 65 ? 'bg-rose-500' : marksScore >= 35 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, marksScore)}%` }}
            />
          </div>
        </div>

        {/* Assignment Component */}
        <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Assignment Risk</span>
            <span className="font-bold text-slate-200">{assignmentScore.toFixed(0)} / 100</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${assignmentScore >= 65 ? 'bg-rose-500' : assignmentScore >= 35 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, assignmentScore)}%` }}
            />
          </div>
        </div>

        {/* Progression Component */}
        <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Progression Risk</span>
            <span className="font-bold text-slate-200">{progressionScore.toFixed(0)} / 100</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${progressionScore >= 65 ? 'bg-rose-500' : progressionScore >= 35 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, progressionScore)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Actionable Recommendations */}
      {recommendations.length > 0 && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-blue-300 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span>Recommended Actions for Academic Health Improvement</span>
          </div>
          <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-1">
            {recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Factors Accordion Toggle */}
      {factors.length > 0 && (
        <div className="border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span>Explainable Primary Risk Factors ({factors.length})</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-2">
              {factors.map((f, idx) => (
                <div key={idx} className="flex items-start justify-between p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-200">{f.message}</span>
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider">Category: {f.category}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${f.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    +{f.points} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
