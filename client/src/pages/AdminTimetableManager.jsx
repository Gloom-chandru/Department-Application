import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  Calendar, Clock, MapPin, Users, BookOpen, AlertTriangle, 
  Plus, Edit2, Trash2, Check, Loader2, X, Info, Settings, ShieldAlert, Layers
} from 'lucide-react';
import { TableSkeleton } from '../components/SkeletonLoader';
import Toast from '../components/Toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AdminTimetableManager = () => {
  const [activeTab, setActiveTab] = useState('schedules'); // 'schedules' | 'periods' | 'rooms'

  // Data states
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [schedules, setSchedules] = useState([]);
  
  // Selection states
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('2024-28');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedSemester, setSelectedSemester] = useState(4);
  const [activeSchedule, setActiveSchedule] = useState(null);

  // Loading states
  const [loadingData, setLoadingData] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form modals
  const [modalType, setModalType] = useState(null); // 'period' | 'room' | 'schedule' | 'slot' | 'bulk'
  const [modalAction, setModalAction] = useState('create'); // 'create' | 'edit'
  const [editId, setEditId] = useState(null);

  // Form states
  const [periodForm, setPeriodForm] = useState({ periodNumber: 1, name: '', startTime: '', endTime: '', isBreak: false });
  const [roomForm, setRoomForm] = useState({ roomNo: '', name: '', departmentId: '', type: 'CLASSROOM', capacity: '', isActive: true });
  const [scheduleForm, setScheduleForm] = useState({ departmentId: '', batchYear: '2024-28', section: 'A', semester: 4, name: '', effectiveFrom: '', effectiveTo: '' });
  const [slotForm, setSlotForm] = useState({ subjectId: '', dayOfWeek: 1, startPeriodId: '', endPeriodId: '', roomId: '' });
  
  // Bulk slot input state (JSON string)
  const [bulkInput, setBulkInput] = useState('');
  const [bulkError, setBulkError] = useState('');

  // Conflict state
  const [conflictErrors, setConflictErrors] = useState([]);

  // Toasts
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const showMsg = (type, text) => {
    setToastType(type);
    setToastMessage(text);
  };

  // Load basic reference data
  const loadReferenceData = async () => {
    try {
      setLoadingData(true);
      const [deptsRes, periodsRes, roomsRes] = await Promise.all([
        api.get('/admin/analytics'), // will contain depts in metadata or dashboard structure
        api.get('/timetable/periods'),
        api.get('/timetable/rooms')
      ]);
      // Actually we can load departments using general metadata or endpoints.
      // Let's call /admin/analytics to get total counts or list depts directly:
      // Let's call '/admin/analytics' or fetch from another endpoints, wait:
      // In AdminDashboard, it fetches departments via `api.get('/admin/analytics')` which returns analytic sets.
      // Let's retrieve departments directly:
      const deptsResult = await api.get('/admin/analytics');
      // AdminDashboard L75 uses: const res = await api.get('/admin/analytics')
      // Let's fetch all schedules to infer depts or see if we can query /admin/analytics' departments property.
      // Let's also check if admin dashboard loads departments via `/admin/analytics` or separate routes.
      // Let's find out by loading analytics.
      if (deptsResult.data && deptsResult.data.departments) {
        setDepartments(deptsResult.data.departments);
        if (deptsResult.data.departments.length > 0) {
          setSelectedDept(deptsResult.data.departments[0].id);
        }
      }
      setPeriods(periodsRes.data);
      setRooms(roomsRes.data);
    } catch (err) {
      console.error(err);
      showMsg('error', 'Failed to load reference data.');
    } finally {
      setLoadingData(false);
    }
  };

  const loadSchedules = async () => {
    try {
      const res = await api.get('/timetable/schedules');
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadReferenceData();
    loadSchedules();
  }, []);

  // When selected department changes, fetch department subjects (taught by any faculty in that dept)
  useEffect(() => {
    if (!selectedDept) return;
    const fetchSubjects = async () => {
      try {
        // Admin dashboard typically gets subjects via CRUD endpoint or analytics
        // Let's fetch all subjects from `/admin/analytics` or similar if needed.
        // Let's call /timetable/schedules or metadata. Actually, can we list subjects?
        // Let's get subjects from admin summary analytics
        const res = await api.get('/admin/analytics');
        if (res.data && res.data.subjects) {
          const deptSubjects = res.data.subjects.filter(s => s.departmentId === selectedDept);
          setSubjects(deptSubjects);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSubjects();
  }, [selectedDept]);

  // Load full details of the active schedule
  const fetchActiveScheduleDetails = async (id) => {
    try {
      setLoadingSchedule(true);
      const res = await api.get(`/timetable/schedules/${id}`);
      setActiveSchedule(res.data);
    } catch (err) {
      console.error(err);
      showMsg('error', 'Failed to load schedule details.');
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Helper: check slots mapping
  const findSlot = (dayNum, periodNum) => {
    if (!activeSchedule) return null;
    return activeSchedule.slots.find(s => {
      if (s.dayOfWeek !== dayNum) return false;
      return periodNum >= s.startPeriod.periodNumber && periodNum <= s.endPeriod.periodNumber;
    });
  };

  // ---- CRUD: PERIODS ----
  const handlePeriodSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...periodForm,
        periodNumber: Number(periodForm.periodNumber)
      };

      if (modalAction === 'create') {
        await api.post('/timetable/periods', payload);
        showMsg('success', 'Period template created.');
      } else {
        await api.patch(`/timetable/periods/${editId}`, payload);
        showMsg('success', 'Period template updated.');
      }
      setModalType(null);
      const res = await api.get('/timetable/periods');
      setPeriods(res.data);
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePeriodDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this period template?')) return;
    try {
      await api.delete(`/timetable/periods/${id}`);
      showMsg('success', 'Period template deleted.');
      const res = await api.get('/timetable/periods');
      setPeriods(res.data);
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Delete failed.');
    }
  };

  // ---- CRUD: ROOMS ----
  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...roomForm,
        capacity: roomForm.capacity ? Number(roomForm.capacity) : null,
        departmentId: roomForm.departmentId || null
      };

      if (modalAction === 'create') {
        await api.post('/timetable/rooms', payload);
        showMsg('success', 'Room created.');
      } else {
        await api.patch(`/timetable/rooms/${editId}`, payload);
        showMsg('success', 'Room updated.');
      }
      setModalType(null);
      const res = await api.get('/timetable/rooms');
      setRooms(res.data);
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoomDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await api.delete(`/timetable/rooms/${id}`);
      showMsg('success', 'Room deleted.');
      const res = await api.get('/timetable/rooms');
      setRooms(res.data);
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Delete failed.');
    }
  };

  // ---- CRUD: SCHEDULES ----
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...scheduleForm,
        semester: Number(scheduleForm.semester),
        effectiveTo: scheduleForm.effectiveTo || null
      };

      const res = await api.post('/timetable/schedules', payload);
      showMsg('success', 'Draft schedule created.');
      setModalType(null);
      loadSchedules();
      fetchActiveScheduleDetails(res.data.id);
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to create schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- CRUD: SLOTS ----
  const handleSlotSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setConflictErrors([]);
      const payload = {
        subjectId: slotForm.subjectId,
        dayOfWeek: Number(slotForm.dayOfWeek),
        startPeriodId: slotForm.startPeriodId,
        endPeriodId: slotForm.endPeriodId,
        roomId: slotForm.roomId || null
      };

      if (modalAction === 'create') {
        await api.post(`/timetable/schedules/${activeSchedule.id}/slots`, payload);
        showMsg('success', 'Slot created.');
      } else {
        await api.patch(`/timetable/slots/${editId}`, payload);
        showMsg('success', 'Slot updated.');
      }
      setModalType(null);
      fetchActiveScheduleDetails(activeSchedule.id);
    } catch (err) {
      if (err.response?.data?.errors) {
        setConflictErrors(err.response.data.errors);
      } else {
        showMsg('error', err.response?.data?.message || 'Action failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSlotDelete = async (id) => {
    if (!window.confirm('Delete this timetable slot?')) return;
    try {
      await api.delete(`/timetable/slots/${id}`);
      showMsg('success', 'Slot deleted.');
      fetchActiveScheduleDetails(activeSchedule.id);
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Delete failed.');
    }
  };

  // ---- BULK SLOTS ----
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setBulkError('');
      setConflictErrors([]);
      
      let parsed;
      try {
        parsed = JSON.parse(bulkInput);
      } catch (err) {
        setBulkError('Invalid JSON format. Please check syntax.');
        return;
      }

      await api.post(`/timetable/schedules/${activeSchedule.id}/slots/bulk`, { slots: parsed });
      showMsg('success', 'Bulk slots imported successfully.');
      setModalType(null);
      fetchActiveScheduleDetails(activeSchedule.id);
    } catch (err) {
      if (err.response?.data?.conflicts) {
        // Nested array errors from validateBulkSlots
        const formatted = err.response.data.conflicts.map(c => `${c.label}: ${c.errors.join(', ')}`);
        setConflictErrors(formatted);
      } else {
        setBulkError(err.response?.data?.message || 'Bulk import failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- PUBLICATION LIFECYCLE ----
  const handlePublishSchedule = async () => {
    if (!window.confirm('Validate and publish this schedule? Students and affected Faculty will be notified immediately.')) return;
    try {
      setSubmitting(true);
      setConflictErrors([]);
      await api.post(`/timetable/schedules/${activeSchedule.id}/publish`);
      showMsg('success', 'Schedule published successfully!');
      fetchActiveScheduleDetails(activeSchedule.id);
      loadSchedules();
    } catch (err) {
      if (err.response?.data?.conflicts) {
        const formatted = err.response.data.conflicts.map(c => `${c.label}: ${c.errors.join(', ')}`);
        setConflictErrors(formatted);
        showMsg('error', 'Cannot publish: Schedule contains conflicts.');
      } else {
        showMsg('error', err.response?.data?.message || 'Publication failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveSchedule = async () => {
    if (!window.confirm('Archive this schedule? It will no longer show as the active schedule in student/faculty views.')) return;
    try {
      setSubmitting(true);
      await api.post(`/timetable/schedules/${activeSchedule.id}/archive`);
      showMsg('success', 'Schedule archived.');
      fetchActiveScheduleDetails(activeSchedule.id);
      loadSchedules();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Archiving failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && <Toast type={toastType} message={toastMessage} onClose={() => setToastMessage('')} />}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4">
        {[
          { id: 'schedules', label: 'Schedules Manager', icon: Calendar },
          { id: 'periods', label: 'Period Templates', icon: Clock },
          { id: 'rooms', label: 'Rooms Configuration', icon: MapPin }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab.id 
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {conflictErrors.length > 0 && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/10 text-red-400 space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <ShieldAlert className="h-5 w-5" />
            <span>Validation Conflicts Found:</span>
          </div>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {conflictErrors.map((err, i) => (
              <li key={i}>{typeof err === 'string' ? err : JSON.stringify(err)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ==================== TAB: SCHEDULES ==================== */}
      {activeTab === 'schedules' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* Schedules list panel */}
          <div className="xl:col-span-1 border border-slate-800 rounded-xl bg-slate-900/20 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200">Schedules</h2>
              <button
                onClick={() => {
                  setModalType('schedule');
                  setScheduleForm({
                    departmentId: departments[0]?.id || '',
                    batchYear: '2024-28',
                    section: 'A',
                    semester: 4,
                    name: '',
                    effectiveFrom: '',
                    effectiveTo: ''
                  });
                }}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                <Plus className="h-4 w-4" /> Create
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {schedules.map(sched => (
                <button
                  key={sched.id}
                  onClick={() => {
                    fetchActiveScheduleDetails(sched.id);
                    setSelectedDept(sched.departmentId);
                  }}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${
                    activeSchedule?.id === sched.id
                      ? 'bg-blue-600/10 border-blue-500/50 text-blue-300'
                      : 'bg-slate-900/35 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="font-bold truncate">{sched.name}</div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Sem {sched.semester} | {sched.department.code} {sched.batchYear} ({sched.section})
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider ${
                      sched.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-400' :
                      sched.status === 'ARCHIVED' ? 'bg-slate-800 text-slate-500' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {sched.status}
                    </span>
                    <span className="text-[9px] text-slate-500">Slots: {sched._count.slots}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Workspace Grid */}
          <div className="xl:col-span-3 space-y-4">
            {activeSchedule ? (
              <div className="border border-slate-800 rounded-xl bg-slate-900/20 p-6 space-y-4">
                
                {/* Header info */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Layers className="h-5 w-5 text-blue-400" />
                      {activeSchedule.name}
                    </h2>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>Semester {activeSchedule.semester}</span>
                      <span>•</span>
                      <span>{activeSchedule.department.code} {activeSchedule.batchYear} (Section {activeSchedule.section})</span>
                      <span>•</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        activeSchedule.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-400' :
                        activeSchedule.status === 'ARCHIVED' ? 'bg-slate-800 text-slate-500' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {activeSchedule.status}
                      </span>
                    </div>
                  </div>

                  {/* Actions depending on status */}
                  <div className="flex gap-2">
                    {activeSchedule.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => {
                            setModalType('bulk');
                            setBulkInput('[\n  {\n    "subjectId": "SUBJECT_UUID",\n    "dayOfWeek": 1,\n    "startPeriodId": "PERIOD_UUID",\n    "endPeriodId": "PERIOD_UUID",\n    "roomId": "ROOM_UUID_OR_NULL"\n  }\n]');
                            setBulkError('');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300"
                        >
                          Bulk Import
                        </button>
                        <button
                          onClick={handlePublishSchedule}
                          disabled={submitting}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5"
                        >
                          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Publish
                        </button>
                      </>
                    )}
                    {activeSchedule.status === 'PUBLISHED' && (
                      <button
                        onClick={handleArchiveSchedule}
                        disabled={submitting}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                      >
                        Archive Schedule
                      </button>
                    )}
                  </div>
                </div>

                {/* Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="p-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-32">Day</th>
                        {periods.map(p => (
                          <th key={p.id} className="p-3 text-center border-b border-slate-800 min-w-[140px]">
                            <div className="text-xs font-bold text-slate-300">{p.name}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{p.startTime} - {p.endTime}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((dayName, dayIndex) => {
                        const dayNum = dayIndex + 1;

                        return (
                          <tr key={dayName} className="border-b border-slate-800/50 hover:bg-slate-850/10">
                            <td className="p-3 font-semibold text-slate-300 text-xs border-r border-slate-800/30">
                              {dayName}
                            </td>

                            {periods.map(p => {
                              if (p.isBreak) {
                                return (
                                  <td key={p.id} className="p-3 bg-slate-950/20 text-center text-[10px] font-bold text-slate-600 border-r border-slate-800/30 select-none">
                                    {p.name}
                                  </td>
                                );
                              }

                              const slot = findSlot(dayNum, p.periodNumber);
                              const isStart = slot && slot.startPeriodId === p.id;
                              const isMiddle = slot && p.periodNumber > slot.startPeriod.periodNumber && p.periodNumber <= slot.endPeriod.periodNumber;

                              if (isMiddle) return null;

                              if (slot) {
                                const span = slot.endPeriod.periodNumber - slot.startPeriod.periodNumber + 1;
                                return (
                                  <td key={p.id} colSpan={span} className="p-2 border-r border-slate-800/30 align-middle">
                                    <div className="group relative flex flex-col justify-between p-3 rounded-lg border border-blue-500/20 bg-blue-950/5 h-20">
                                      <div className="font-bold text-xs text-blue-300 truncate">{slot.subject.code}</div>
                                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{slot.subject.name}</div>
                                      <div className="text-[9px] text-slate-500 mt-1 flex items-center justify-between">
                                        <span className="truncate max-w-[65%]">{slot.subject.faculty.user.name}</span>
                                        {slot.room && <span className="font-semibold text-slate-300">{slot.room.roomNo}</span>}
                                      </div>

                                      {/* Slot actions on hover */}
                                      {activeSchedule.status === 'DRAFT' && (
                                        <div className="absolute inset-0 bg-slate-950/90 rounded-lg flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={() => {
                                              setModalType('slot');
                                              setModalAction('edit');
                                              setEditId(slot.id);
                                              setSlotForm({
                                                subjectId: slot.subjectId,
                                                dayOfWeek: slot.dayOfWeek,
                                                startPeriodId: slot.startPeriodId,
                                                endPeriodId: slot.endPeriodId,
                                                roomId: slot.roomId || ''
                                              });
                                            }}
                                            className="p-1 text-slate-400 hover:text-blue-400"
                                            title="Edit Slot"
                                          >
                                            <Edit2 className="h-4 w-4" />
                                          </button>
                                          <button
                                            onClick={() => handleSlotDelete(slot.id)}
                                            className="p-1 text-slate-400 hover:text-red-400"
                                            title="Delete Slot"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              }

                              return (
                                <td key={p.id} className="p-2 border-r border-slate-800/30">
                                  {activeSchedule.status === 'DRAFT' ? (
                                    <button
                                      onClick={() => {
                                        setModalType('slot');
                                        setModalAction('create');
                                        setConflictErrors([]);
                                        setSlotForm({
                                          subjectId: subjects[0]?.id || '',
                                          dayOfWeek: dayNum,
                                          startPeriodId: p.id,
                                          endPeriodId: p.id,
                                          roomId: ''
                                        });
                                      }}
                                      className="w-full h-20 rounded-lg border border-dashed border-slate-800/40 text-slate-700 hover:text-blue-400 hover:border-blue-500/30 flex items-center justify-center text-xs group transition-all"
                                    >
                                      <Plus className="h-4 w-4 opacity-30 group-hover:opacity-100" />
                                    </button>
                                  ) : (
                                    <div className="h-20 flex items-center justify-center text-[10px] text-slate-750 select-none">-</div>
                                  )}
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
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-12 border border-slate-800 rounded-xl bg-slate-900/20 h-[60vh]">
                <Calendar className="h-12 w-12 text-slate-650 mb-3" />
                <h3 className="text-lg font-semibold text-slate-400">Select or Create a Timetable Schedule</h3>
                <p className="text-slate-500 text-sm max-w-sm mt-1">
                  Choose a schedule from the sidebar, or click "Create" to start building a new weekly draft timetable.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB: PERIOD TEMPLATES ==================== */}
      {activeTab === 'periods' && (
        <div className="border border-slate-800 rounded-xl bg-slate-900/20 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-md font-bold text-white">Daily Period Templates</h2>
              <p className="text-xs text-slate-400 mt-0.5">Define class hours and break periods.</p>
            </div>
            <button
              onClick={() => {
                setModalType('period');
                setModalAction('create');
                setPeriodForm({ periodNumber: periods.length + 1, name: `Period ${periods.length + 1}`, startTime: '', endTime: '', isBreak: false });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Add Period
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase">Number</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase">Name</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase">Time Range</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase">Type</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {periods.map(p => (
                  <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-850/5">
                    <td className="p-3 font-semibold text-slate-200 text-sm">{p.periodNumber}</td>
                    <td className="p-3 text-slate-300 text-sm">{p.name}</td>
                    <td className="p-3 text-slate-400 text-xs">{p.startTime} - {p.endTime}</td>
                    <td className="p-3 text-sm">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        p.isBreak ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {p.isBreak ? 'BREAK' : 'ACADEMIC'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => {
                            setModalType('period');
                            setModalAction('edit');
                            setEditId(p.id);
                            setPeriodForm({ periodNumber: p.periodNumber, name: p.name, startTime: p.startTime, endTime: p.endTime, isBreak: p.isBreak });
                          }}
                          className="text-slate-400 hover:text-blue-400 p-1"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handlePeriodDelete(p.id)}
                          className="text-slate-400 hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB: ROOMS ==================== */}
      {activeTab === 'rooms' && (
        <div className="border border-slate-800 rounded-xl bg-slate-900/20 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-md font-bold text-white">Classrooms & Labs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Manage physical locations for classes.</p>
            </div>
            <button
              onClick={() => {
                setModalType('room');
                setModalAction('create');
                setRoomForm({ roomNo: '', name: '', departmentId: departments[0]?.id || '', type: 'CLASSROOM', capacity: '', isActive: true });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Add Room
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase">Room No</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase">Name / Desc</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase">Department</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase">Type</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase">Capacity</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(r => (
                  <tr key={r.id} className="border-b border-slate-800/40 hover:bg-slate-850/5">
                    <td className="p-3 font-semibold text-slate-200 text-sm">{r.roomNo}</td>
                    <td className="p-3 text-slate-300 text-sm">{r.name || '-'}</td>
                    <td className="p-3 text-slate-400 text-xs">{r.department?.code || 'Global / All'}</td>
                    <td className="p-3 text-xs font-bold">{r.type}</td>
                    <td className="p-3 text-slate-400 text-sm">{r.capacity || '-'}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => {
                            setModalType('room');
                            setModalAction('edit');
                            setEditId(r.id);
                            setRoomForm({ roomNo: r.roomNo, name: r.name || '', departmentId: r.departmentId || '', type: r.type, capacity: r.capacity || '', isActive: r.isActive });
                          }}
                          className="text-slate-400 hover:text-blue-400 p-1"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRoomDelete(r.id)}
                          className="text-slate-400 hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== FORM MODALS ==================== */}

      {/* 1. Schedule Modal */}
      {modalType === 'schedule' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-md">Create Weekly Timetable Schedule</h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleScheduleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Department</label>
                <select
                  value={scheduleForm.departmentId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, departmentId: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                  required
                >
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Batch Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2024-28"
                    value={scheduleForm.batchYear}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, batchYear: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Section</label>
                  <input
                    type="text"
                    placeholder="e.g. A"
                    maxLength={2}
                    value={scheduleForm.section}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, section: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Semester</label>
                  <input
                    type="number"
                    min={1} max={8}
                    value={scheduleForm.semester}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, semester: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Schedule Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Odd Sem 2026"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Effective From</label>
                  <input
                    type="date"
                    value={scheduleForm.effectiveFrom}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, effectiveFrom: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Effective To (Optional)</label>
                  <input
                    type="date"
                    value={scheduleForm.effectiveTo}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, effectiveTo: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-white flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Draft Schedule
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Slot Modal */}
      {modalType === 'slot' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-md">
                {modalAction === 'create' ? 'Create Timetable Slot' : 'Edit Timetable Slot'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSlotSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Subject</label>
                <select
                  value={slotForm.subjectId}
                  onChange={(e) => setSlotForm({ ...slotForm, subjectId: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                  required
                >
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                  {subjects.length === 0 && <option value="">No subjects found in department</option>}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Start Period</label>
                  <select
                    value={slotForm.startPeriodId}
                    onChange={(e) => setSlotForm({ ...slotForm, startPeriodId: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  >
                    {periods.map(p => <option key={p.id} value={p.id}>{p.name} ({p.startTime})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">End Period</label>
                  <select
                    value={slotForm.endPeriodId}
                    onChange={(e) => setSlotForm({ ...slotForm, endPeriodId: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  >
                    {periods.map(p => <option key={p.id} value={p.id}>{p.name} ({p.endTime})</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Room No (Optional)</label>
                <select
                  value={slotForm.roomId}
                  onChange={(e) => setSlotForm({ ...slotForm, roomId: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                >
                  <option value="">No Room Assigned</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.roomNo} ({r.type})</option>)}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-white flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {modalAction === 'create' ? 'Save Timetable Slot' : 'Update Timetable Slot'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Bulk JSON Import Modal */}
      {modalType === 'bulk' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-md">Bulk JSON Timetable Import</h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleBulkSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">JSON Array of Slots</label>
                <textarea
                  rows={10}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-200 font-mono text-[11px]"
                  placeholder="Paste JSON array here..."
                  required
                />
              </div>

              {bulkError && <div className="text-red-400 text-xs font-semibold">{bulkError}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-white flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Atomically Import Slots
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Period Modal */}
      {modalType === 'period' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-md">
                {modalAction === 'create' ? 'Add Period Template' : 'Edit Period Template'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handlePeriodSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Period Number</label>
                  <input
                    type="number"
                    min={1} max={10}
                    value={periodForm.periodNumber}
                    onChange={(e) => setPeriodForm({ ...periodForm, periodNumber: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Display Name</label>
                  <input
                    type="text"
                    value={periodForm.name}
                    onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Start Time (HH:mm)</label>
                  <input
                    type="text"
                    placeholder="e.g. 09:00"
                    value={periodForm.startTime}
                    onChange={(e) => setPeriodForm({ ...periodForm, startTime: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">End Time (HH:mm)</label>
                  <input
                    type="text"
                    placeholder="e.g. 09:50"
                    value={periodForm.endTime}
                    onChange={(e) => setPeriodForm({ ...periodForm, endTime: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isBreak"
                  checked={periodForm.isBreak}
                  onChange={(e) => setPeriodForm({ ...periodForm, isBreak: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-950 text-blue-500"
                />
                <label htmlFor="isBreak" className="text-slate-350 font-semibold">Is institutional break / lunch period?</label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-white flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {modalAction === 'create' ? 'Create Period' : 'Update Period'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Room Modal */}
      {modalType === 'room' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-md">
                {modalAction === 'create' ? 'Add Room' : 'Edit Room'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleRoomSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Room Number</label>
                  <input
                    type="text"
                    placeholder="e.g. R-101"
                    value={roomForm.roomNo}
                    onChange={(e) => setRoomForm({ ...roomForm, roomNo: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Room Name (Optional)</label>
                  <input
                    type="text"
                    value={roomForm.name}
                    onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Room Type</label>
                  <select
                    value={roomForm.type}
                    onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                  >
                    <option value="CLASSROOM">Classroom</option>
                    <option value="LAB">Laboratory</option>
                    <option value="SEMINAR_HALL">Seminar Hall</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">Capacity (Optional)</label>
                  <input
                    type="number"
                    value={roomForm.capacity}
                    onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">Department Assignment (Optional)</label>
                <select
                  value={roomForm.departmentId}
                  onChange={(e) => setRoomForm({ ...roomForm, departmentId: e.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-slate-200"
                >
                  <option value="">Global / All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-white flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {modalAction === 'create' ? 'Create Room' : 'Update Room'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminTimetableManager;
