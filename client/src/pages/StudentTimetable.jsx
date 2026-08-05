import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Calendar, Clock, MapPin, User, ChevronLeft, ChevronRight, AlertCircle, Info, Loader2 } from 'lucide-react';
import Toast from '../components/Toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// A premium palette of soft, vibrant subject colors
const SUBJECT_COLORS = [
  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'bg-rose-500/10 text-rose-400 border-rose-500/30',
  'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  'bg-teal-500/10 text-teal-400 border-teal-500/30'
];

// Helper to get a color index from subject code
const getSubjectColor = (code) => {
  if (!code) return SUBJECT_COLORS[0];
  let sum = 0;
  for (let i = 0; i < code.length; i++) {
    sum += code.charCodeAt(i);
  }
  return SUBJECT_COLORS[sum % SUBJECT_COLORS.length];
};

const StudentTimetable = () => {
  const [selectedSemester, setSelectedSemester] = useState(4);
  const [schedule, setSchedule] = useState(null);
  const [slots, setSlots] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  // Mobile active day index (1 = Monday, etc.)
  const [activeMobileDay, setActiveMobileDay] = useState(new Date().getDay() || 1);
  if (activeMobileDay > 6) setActiveMobileDay(1); // Default to Monday if Sunday

  // Time tracker for highlighting active period
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // update every minute
    return () => clearInterval(timer);
  }, []);

  const fetchTimetable = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/timetable/student?semester=${selectedSemester}`);
      setSchedule(res.data.schedule);
      setSlots(res.data.slots);
      setPeriods(res.data.periods);
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage(err.response?.data?.message || 'Failed to fetch timetable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [selectedSemester]);

  // Determine if a day/period is currently active
  const isPeriodActive = (dayIndex, startTimeStr, endTimeStr) => {
    const day = currentTime.getDay();
    if (day !== dayIndex) return false;

    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);
    const currentH = currentTime.getHours();
    const currentM = currentTime.getMinutes();

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const currentMinutes = currentH * 60 + currentM;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  };

  // Find slot for a day and period number
  const findSlot = (dayNum, periodNum) => {
    return slots.find(s => {
      if (s.dayOfWeek !== dayNum) return false;
      return periodNum >= s.startPeriod.periodNumber && periodNum <= s.endPeriod.periodNumber;
    });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toastMessage && <Toast type={toastType} message={toastMessage} onClose={() => setToastMessage('')} />}

      {/* Header card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border-app bg-bg-card/50 p-6 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-500" />
            Class Timetable
          </h1>
          <p className="text-text-muted mt-1">
            {schedule 
              ? `Active Schedule: ${schedule.name} (${schedule.batchYear} Section ${schedule.section})`
              : 'No active published timetable schedule found for this semester.'}
          </p>
        </div>

        {/* Semester Selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-text-main">Semester:</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(Number(e.target.value))}
            className="rounded-lg border border-border-app bg-bg-app px-3 py-2 text-text-main focus:border-blue-500 focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
              <option key={sem} value={sem}>Semester {sem}</option>
            ))}
          </select>
        </div>
      </div>

      {schedule && (
        <div className="rounded-xl border border-border-app bg-bg-card/20 backdrop-blur-sm p-4">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-4 px-2">
            <Info className="h-4 w-4 text-blue-500 shrink-0" />
            <span>Effective from {new Date(schedule.effectiveFrom).toLocaleDateString()} {schedule.effectiveTo ? `to ${new Date(schedule.effectiveTo).toLocaleDateString()}` : '(Ongoing)'}</span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border-app w-32">Day</th>
                  {periods.map(p => (
                    <th key={p.id} className="p-3 text-center border-b border-border-app min-w-[140px]">
                      <div className="text-xs font-bold text-text-main">{p.name}</div>
                      <div className="text-[10px] text-text-muted flex items-center justify-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {p.startTime} - {p.endTime}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((dayName, index) => {
                  const dayNum = index + 1; // 1 = Mon
                  const isCurrentDay = currentTime.getDay() === dayNum;

                  return (
                    <tr 
                      key={dayName} 
                      className={`border-b border-border-card/50 transition-colors ${
                        isCurrentDay ? 'bg-blue-900/5' : ''
                      }`}
                    >
                      <td className="p-3 font-semibold text-text-main text-sm border-r border-border-app/30">
                        <div className="flex items-center gap-2">
                          {isCurrentDay && <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>}
                          {dayName}
                        </div>
                      </td>

                      {periods.map(p => {
                        if (p.isBreak) {
                          return (
                            <td key={p.id} className="p-3 bg-bg-app/40 text-center text-xs font-semibold text-text-muted border-r border-border-app/30 select-none">
                              {p.name}
                            </td>
                          );
                        }

                        const slot = findSlot(dayNum, p.periodNumber);
                        const isCurrentlyActive = isPeriodActive(dayNum, p.startTime, p.endTime);

                        if (!slot) {
                          return (
                            <td key={p.id} className="p-3 border-r border-border-app/30">
                              <div className="flex flex-col items-center justify-center h-20 rounded-lg border border-dashed border-border-app/40 text-text-muted text-xs select-none">
                                Free Period
                              </div>
                            </td>
                          );
                        }

                        // Determine if we need a colSpan (e.g. if this slot covers multiple periods and this is the start period)
                        const isStart = slot.startPeriodId === p.id;
                        const isMiddle = p.periodNumber > slot.startPeriod.periodNumber && p.periodNumber <= slot.endPeriod.periodNumber;

                        if (isMiddle) {
                          // Hide this cell since the start period cell spans over it
                          return null;
                        }

                        const span = slot.endPeriod.periodNumber - slot.startPeriod.periodNumber + 1;
                        const colColor = getSubjectColor(slot.subject.code);

                        return (
                          <td 
                            key={p.id} 
                            colSpan={span} 
                            className="p-2 border-r border-border-app/30 align-middle"
                          >
                            <div 
                              className={`flex flex-col justify-between p-3 rounded-lg border h-20 transition-all duration-200 ${colColor} ${
                                isCurrentlyActive ? 'ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/5' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-bold text-sm tracking-tight truncate">{slot.subject.code}</span>
                                {isCurrentlyActive && (
                                  <span className="flex items-center gap-1 rounded bg-blue-500 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-main">
                                    LIVE
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-medium truncate text-text-main mt-0.5">{slot.subject.name}</div>
                              <div className="flex items-center justify-between text-[10px] text-text-muted mt-1">
                                <span className="flex items-center gap-0.5 truncate max-w-[65%]">
                                  <User className="h-3 w-3 shrink-0 text-text-muted" />
                                  {slot.subject.faculty.user.name}
                                </span>
                                {slot.room && (
                                  <span className="flex items-center gap-0.5 font-semibold text-text-main">
                                    <MapPin className="h-3 w-3 text-text-muted" />
                                    {slot.room.roomNo}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View (Collapsible Daily Agenda) */}
          <div className="lg:hidden">
            {/* Day Selector Navigation */}
            <div className="flex items-center justify-between bg-bg-card border border-border-app rounded-lg p-2 mb-4">
              <button 
                onClick={() => setActiveMobileDay(prev => prev > 1 ? prev - 1 : 6)}
                className="p-2 text-text-muted hover:text-text-main"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="font-bold text-sm text-text-main">{DAYS[activeMobileDay - 1]}</span>
              <button 
                onClick={() => setActiveMobileDay(prev => prev < 6 ? prev + 1 : 1)}
                className="p-2 text-text-muted hover:text-text-main"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* List of Periods for the Active Day */}
            <div className="space-y-3">
              {periods.map(p => {
                if (p.isBreak) {
                  return (
                    <div key={p.id} className="flex items-center justify-center py-2.5 px-4 bg-bg-app/30 rounded-lg border border-border-app/40 text-xs font-semibold text-text-muted select-none">
                      {p.name} ({p.startTime} - {p.endTime})
                    </div>
                  );
                }

                const slot = findSlot(activeMobileDay, p.periodNumber);
                const isCurrentlyActive = isPeriodActive(activeMobileDay, p.startTime, p.endTime);
                
                // If it is a multi-period slot, only show details on the first period cell.
                // For later periods of the same slot, render a continuation bar or omit.
                const isStart = slot && slot.startPeriodId === p.id;
                const isMiddle = slot && p.periodNumber > slot.startPeriod.periodNumber && p.periodNumber <= slot.endPeriod.periodNumber;

                if (isMiddle) {
                  return (
                    <div key={p.id} className="flex items-center gap-3 pl-4 text-xs text-text-muted">
                      <div className="w-16 text-right shrink-0">{p.startTime}</div>
                      <div className="h-4 border-l border-border-card/50"></div>
                      <div>Continuation of {slot.subject.code}</div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={p.id} 
                    className={`flex items-start gap-4 p-3 rounded-lg border transition-all duration-200 ${
                      isCurrentlyActive ? 'bg-blue-950/10 border-blue-500/50 ring-1 ring-blue-500/30' : 'bg-bg-card/30 border-border-app/60'
                    }`}
                  >
                    {/* Time Column */}
                    <div className="w-16 shrink-0 pt-0.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{p.name}</div>
                      <div className="text-xs font-medium text-text-main mt-0.5">{p.startTime}</div>
                      <div className="text-[10px] text-text-muted">{p.endTime}</div>
                    </div>

                    <div className="h-10 border-l border-border-app/80 align-self-stretch shrink-0"></div>

                    {/* Slot Info Column */}
                    <div className="flex-1 min-w-0">
                      {slot ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-text-main truncate">{slot.subject.code} - {slot.subject.name}</span>
                            {isCurrentlyActive && (
                              <span className="rounded bg-blue-500 px-1 py-0.5 text-[8px] font-bold tracking-wider text-text-main">LIVE</span>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center justify-between text-xs text-text-muted pt-0.5">
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-text-muted shrink-0" />
                              {slot.subject.faculty.user.name}
                            </span>
                            {slot.room && (
                              <span className="flex items-center gap-1 font-semibold text-text-main">
                                <MapPin className="h-3.5 w-3.5 text-text-muted shrink-0" />
                                Room {slot.room.roomNo}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-text-muted italic py-2">Free Period</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!schedule && (
        <div className="flex flex-col items-center justify-center text-center p-12 border border-border-app rounded-xl bg-bg-card/20">
          <AlertCircle className="h-12 w-12 text-text-muted mb-3" />
          <h3 className="text-lg font-semibold text-text-main">No Timetable Schedule Available</h3>
          <p className="text-text-muted text-sm max-w-sm mt-1">
            There is currently no published timetable schedule matching your group for Semester {selectedSemester}.
          </p>
        </div>
      )}
    </div>
  );
};

export default StudentTimetable;
