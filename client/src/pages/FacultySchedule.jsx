import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Calendar, Clock, MapPin, Users, BookOpen, AlertCircle, Info, Loader2 } from 'lucide-react';
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

// Helper to get color index
const getSubjectColor = (code) => {
  if (!code) return SUBJECT_COLORS[0];
  let sum = 0;
  for (let i = 0; i < code.length; i++) {
    sum += code.charCodeAt(i);
  }
  return SUBJECT_COLORS[sum % SUBJECT_COLORS.length];
};

const FacultySchedule = () => {
  const [selectedSemester, setSelectedSemester] = useState('');
  const [slots, setSlots] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [teachingLoad, setTeachingLoad] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const url = selectedSemester 
        ? `/timetable/faculty?semester=${selectedSemester}`
        : '/timetable/faculty';
      const res = await api.get(url);
      setSlots(res.data.slots);
      setPeriods(res.data.periods);
      setTeachingLoad(res.data.teachingLoad);
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage(err.response?.data?.message || 'Failed to fetch schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [selectedSemester]);

  // Find slot for day and period
  const findSlot = (dayNum, periodNum) => {
    return slots.find(s => {
      if (s.dayOfWeek !== dayNum) return false;
      return periodNum >= s.startPeriod.periodNumber && periodNum <= s.endPeriod.periodNumber;
    });
  };

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

      {/* Header and Load Summary card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col justify-between rounded-xl border border-border-app bg-bg-card/50 p-6 backdrop-blur-sm">
          <div>
            <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-500" />
              My Teaching Schedule
            </h1>
            <p className="text-text-muted mt-1">
              Your weekly classroom timetable. Teaching assignments across semesters and student groups are shown.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <label className="text-sm font-medium text-text-main">Semester Filter:</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="rounded-lg border border-border-app bg-bg-app px-3 py-2 text-text-main focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Load Stat Card */}
        <div className="rounded-xl border border-border-app bg-gradient-to-br from-blue-950/20 to-slate-950 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-muted">Weekly Teaching Load</span>
            <BookOpen className="h-5 w-5 text-blue-400" />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-text-main">{teachingLoad}</span>
            <span className="text-text-muted text-sm ml-2">periods / week</span>
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            Calculated as the sum of periods in your active published classes.
          </p>
        </div>
      </div>

      {slots.length > 0 ? (
        <div className="rounded-xl border border-border-app bg-bg-card/20 backdrop-blur-sm p-4">
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
                  const dayNum = index + 1;
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
                                -
                              </div>
                            </td>
                          );
                        }

                        // Check colSpan continuation for multi-period slots
                        const isStart = slot.startPeriodId === p.id;
                        const isMiddle = p.periodNumber > slot.startPeriod.periodNumber && p.periodNumber <= slot.endPeriod.periodNumber;

                        if (isMiddle) return null;

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
                              <div className="text-[10px] font-medium text-text-main truncate mt-0.5">{slot.subject.name}</div>
                              <div className="flex items-center justify-between text-[10px] text-text-muted mt-1">
                                <span className="flex items-center gap-0.5 truncate font-semibold text-text-main">
                                  <Users className="h-3 w-3 text-text-muted" />
                                  {slot.schedule.department.code} {slot.schedule.batchYear} ({slot.schedule.section})
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

          {/* Mobile View */}
          <div className="lg:hidden space-y-4">
            {DAYS.map((dayName, dayIndex) => {
              const dayNum = dayIndex + 1;
              const daySlots = slots.filter(s => s.dayOfWeek === dayNum);

              if (daySlots.length === 0) return null;

              return (
                <div key={dayName} className="rounded-lg border border-border-app/80 bg-bg-card/40 p-4">
                  <h3 className="font-bold text-sm text-text-main mb-3 border-b border-border-app pb-2">{dayName}</h3>
                  <div className="space-y-3">
                    {daySlots.map(slot => {
                      const isCurrentlyActive = isPeriodActive(dayNum, slot.startPeriod.startTime, slot.endPeriod.endTime);

                      return (
                        <div 
                          key={slot.id} 
                          className={`flex items-start gap-4 p-3 rounded-lg border transition-all duration-200 ${
                            isCurrentlyActive ? 'bg-blue-950/15 border-blue-500/50' : 'bg-bg-card/20 border-border-app/60'
                          }`}
                        >
                          <div className="w-20 shrink-0">
                            <span className="text-[10px] font-bold text-text-muted block uppercase">
                              P{slot.startPeriod.periodNumber}{slot.startPeriod.periodNumber !== slot.endPeriod.periodNumber ? `-P${slot.endPeriod.periodNumber}` : ''}
                            </span>
                            <span className="text-xs font-semibold text-text-main mt-0.5 block">{slot.startPeriod.startTime}</span>
                            <span className="text-[10px] text-text-muted block">{slot.endPeriod.endTime}</span>
                          </div>

                          <div className="h-10 border-l border-border-app shrink-0"></div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-sm text-text-main block truncate">{slot.subject.code} - {slot.subject.name}</span>
                              {isCurrentlyActive && (
                                <span className="rounded bg-blue-500 px-1 py-0.5 text-[8px] font-bold uppercase text-text-main">LIVE</span>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-xs text-text-muted mt-1">
                              <span className="flex items-center gap-1 font-semibold text-text-main">
                                <Users className="h-3.5 w-3.5 text-text-muted shrink-0" />
                                {slot.schedule.department.code} {slot.schedule.batchYear} ({slot.schedule.section})
                              </span>
                              {slot.room && (
                                <span className="flex items-center gap-1 font-semibold text-text-main">
                                  <MapPin className="h-3.5 w-3.5 text-text-muted shrink-0" />
                                  Room {slot.room.roomNo}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-12 border border-border-app rounded-xl bg-bg-card/20">
          <AlertCircle className="h-12 w-12 text-text-muted mb-3" />
          <h3 className="text-lg font-semibold text-text-main">No Classes Scheduled</h3>
          <p className="text-text-muted text-sm max-w-sm mt-1">
            You don't have any scheduled periods this semester.
          </p>
        </div>
      )}
    </div>
  );
};

export default FacultySchedule;
