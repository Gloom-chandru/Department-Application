import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  Save, Calendar, Award, UserCheck, AlertCircle, Check, Loader2, Info
} from 'lucide-react';
import { TableSkeleton } from '../components/SkeletonLoader';
import Toast from '../components/Toast';

const FacultyDashboard = () => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  
  // Selection criteria
  const [selectedBatch, setSelectedBatch] = useState('2024-28');
  const [selectedSection, setSelectedSection] = useState('A');
  const [activeTab, setActiveTab] = useState('attendance');

  // Student list
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Attendance state
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({}); // { studentId: 'PRESENT' | 'ABSENT' | null }
  const [dateError, setDateError] = useState('');
  const [attendanceError, setAttendanceError] = useState('');
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Marks state
  const [examType, setExamType] = useState('INTERNAL1');
  const [maxMarks, setMaxMarks] = useState(50);
  const [marksRecords, setMarksRecords] = useState({}); // { studentId: marksObtained }
  const [marksErrors, setMarksErrors] = useState({}); // { studentId: errorMessage }
  const [savingMarks, setSavingMarks] = useState(false);

  // Toasts
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  // Fetch subjects taught by faculty
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoadingSubjects(true);
        const res = await api.get('/faculty/subjects');
        setSubjects(res.data);
        if (res.data.length > 0) {
          setSelectedSubject(res.data[0].id);
        }
      } catch (err) {
        console.error(err);
        setToastType('error');
        setToastMessage('Failed to fetch your assigned subjects.');
      } finally {
        setLoadingSubjects(false);
      }
    };
    fetchSubjects();
  }, []);

  // Fetch students list when selection criteria change
  useEffect(() => {
    if (!selectedSubject) return;

    const fetchStudents = async () => {
      try {
        setLoadingStudents(true);
        setStudents([]);
        setDateError('');
        setAttendanceError('');
        setMarksErrors({});
        
        const subjectObj = subjects.find(s => s.id === selectedSubject);
        if (!subjectObj) return;

        const studentsRes = await api.get('/faculty/students', {
          params: {
            departmentId: subjectObj.departmentId,
            batchYear: selectedBatch,
            section: selectedSection,
          },
        });
        setStudents(studentsRes.data);

        // Load existing records depending on tab
        if (activeTab === 'attendance') {
          await loadExistingAttendance(selectedSubject, attendanceDate, studentsRes.data);
        } else {
          await loadExistingMarks(selectedSubject, examType, studentsRes.data);
        }
      } catch (err) {
        console.error(err);
        setToastType('error');
        setToastMessage('Error loading students list.');
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [selectedSubject, selectedBatch, selectedSection, activeTab, attendanceDate, examType]);

  // Adjust max marks default based on exam type selection
  useEffect(() => {
    if (examType === 'SEMESTER') {
      setMaxMarks(100);
    } else {
      setMaxMarks(50);
    }
  }, [examType]);

  const loadExistingAttendance = async (subjectId, date, studentList) => {
    try {
      const res = await api.get('/faculty/attendance/existing', {
        params: { subjectId, date },
      });
      
      const newAttendance = {};
      // Require explicit marking (initialize to null)
      studentList.forEach(s => {
        newAttendance[s.id] = null;
      });

      // Override with existing database records
      res.data.forEach(rec => {
        newAttendance[rec.studentId] = rec.status;
      });

      setAttendanceRecords(newAttendance);
    } catch (err) {
      console.error(err);
    }
  };

  const loadExistingMarks = async (subjectId, type, studentList) => {
    try {
      const res = await api.get('/faculty/marks/existing', {
        params: { subjectId, examType: type },
      });

      const newMarks = {};
      studentList.forEach(s => {
        newMarks[s.id] = '';
      });

      res.data.forEach(rec => {
        newMarks[rec.studentId] = rec.marksObtained;
        if (rec.maxMarks) {
          setMaxMarks(rec.maxMarks);
        }
      });

      setMarksRecords(newMarks);
    } catch (err) {
      console.error(err);
    }
  };

  // Inline check for future dates
  const handleDateChange = (val) => {
    setAttendanceDate(val);
    setDateError('');
    setAttendanceError('');

    const selected = new Date(val + 'T00:00:00');
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Allow marking for today

    if (selected > today) {
      setDateError('Cannot mark attendance for future dates.');
    }
  };

  const handleToggleAttendance = (studentId, status) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: prev[studentId] === status ? null : status,
    }));
    if (attendanceError) setAttendanceError('');
  };

  const handleSelectAllPresent = () => {
    const newAttendance = {};
    students.forEach(s => {
      newAttendance[s.id] = 'PRESENT';
    });
    setAttendanceRecords(newAttendance);
    if (attendanceError) setAttendanceError('');
  };

  const handleSelectAllAbsent = () => {
    const newAttendance = {};
    students.forEach(s => {
      newAttendance[s.id] = 'ABSENT';
    });
    setAttendanceRecords(newAttendance);
    if (attendanceError) setAttendanceError('');
  };

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSubject || students.length === 0) return;

    // 1. Date check
    if (dateError) {
      setToastType('error');
      setToastMessage('Date validation failed. Correct the date first.');
      return;
    }

    // 2. Grid validation: Check if any student is left unmarked
    const unmarked = students.filter(s => attendanceRecords[s.id] === null);
    if (unmarked.length > 0) {
      setAttendanceError(`Unmarked student found! Please mark attendance for all ${students.length} students.`);
      setToastType('error');
      setToastMessage('Please mark attendance for all students.');
      return;
    }

    try {
      setSavingAttendance(true);
      const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
        studentId,
        status,
      }));

      await api.post('/faculty/attendance', {
        subjectId: selectedSubject,
        date: attendanceDate,
        records,
      });

      setToastType('success');
      setToastMessage(`Attendance for ${attendanceDate} published successfully!`);
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage(err.response?.data?.message || 'Error recording attendance.');
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleMarkChange = (studentId, value) => {
    // Clear errors when typing
    setMarksErrors(prev => ({ ...prev, [studentId]: '' }));

    if (value === '') {
      setMarksRecords(prev => ({ ...prev, [studentId]: '' }));
      return;
    }

    const parsed = parseFloat(value);
    
    // Inline validation checks
    if (isNaN(parsed) || parsed < 0) {
      setMarksErrors(prev => ({ ...prev, [studentId]: 'Marks must be positive.' }));
    } else if (parsed > maxMarks) {
      setMarksErrors(prev => ({ ...prev, [studentId]: `Cannot exceed max marks (${maxMarks}).` }));
    }

    setMarksRecords(prev => ({
      ...prev,
      [studentId]: value === '' ? '' : parsed,
    }));
  };

  const handleMarksSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSubject || students.length === 0) return;

    const records = [];
    let hasErrors = false;
    const newErrors = {};

    for (const student of students) {
      const val = marksRecords[student.id];
      if (val === '' || val === undefined || isNaN(val)) {
        newErrors[student.id] = 'Marks required.';
        hasErrors = true;
      } else {
        const parsed = parseFloat(val);
        if (parsed < 0) {
          newErrors[student.id] = 'Must be positive.';
          hasErrors = true;
        } else if (parsed > maxMarks) {
          newErrors[student.id] = `Exceeds max (${maxMarks}).`;
          hasErrors = true;
        } else {
          records.push({
            studentId: student.id,
            marksObtained: parsed,
          });
        }
      }
    }

    if (hasErrors) {
      setMarksErrors(newErrors);
      setToastType('error');
      setToastMessage('Validation failed. Please correct the invalid marks.');
      return;
    }

    try {
      setSavingMarks(true);
      await api.post('/faculty/marks', {
        subjectId: selectedSubject,
        examType,
        maxMarks: parseFloat(maxMarks),
        records,
      });

      setToastType('success');
      setToastMessage(`Marks for ${examType} updated successfully!`);
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage(err.response?.data?.message || 'Error recording marks.');
    } finally {
      setSavingMarks(false);
    }
  };

  if (loadingSubjects) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
        <span className="ml-3 text-slate-400">Loading academic subjects...</span>
      </div>
    );
  }

  const activeSubjectObj = subjects.find(s => s.id === selectedSubject);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      
      {/* HEADER CONTROLS */}
      <div className="backdrop-blur-md bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Faculty Gradebook & Registry</h1>
          <p className="text-slate-400 text-sm">Select subject, batch, and section to view registries and grade sheets.</p>
        </div>

        {/* SELECTORS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Subject Dropdown */}
          <div className="space-y-1">
            <label htmlFor="subject-select" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subject</label>
            <select
              id="subject-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="block w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} - {sub.name} (Sem {sub.semester})
                </option>
              ))}
              {subjects.length === 0 && <option>No subjects assigned</option>}
            </select>
          </div>

          {/* Batch Dropdown */}
          <div className="space-y-1">
            <label htmlFor="batch-select" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Batch Year</label>
            <select
              id="batch-select"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="block w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="2024-28">2024-28 (Second Year)</option>
              <option value="2025-29">2025-29 (First Year)</option>
            </select>
          </div>

          {/* Section Dropdown */}
          <div className="space-y-1">
            <label htmlFor="section-select" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Section</label>
            <select
              id="section-select"
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="block w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>

          {/* Department Code Display */}
          <div className="space-y-1 flex flex-col justify-end">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3.5 text-xs font-medium text-slate-400">
              Department:{' '}
              <span className="text-white font-semibold">
                {activeSubjectObj?.department?.code || 'AIDS'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS HEADER */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('attendance')}
          type="button"
          aria-label="Switch to Attendance Registry panel"
          className={`flex items-center gap-2 border-b-2 px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'attendance'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Attendance Registry</span>
        </button>
        <button
          onClick={() => setActiveTab('marks')}
          type="button"
          aria-label="Switch to Marks Entry Spreadsheet panel"
          className={`flex items-center gap-2 border-b-2 px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'marks'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Marks Entry Spreadsheet</span>
        </button>
      </div>

      {/* REGISTRY CONTENT */}
      {loadingStudents ? (
        <div className="bg-slate-900/10 border border-slate-800/80 rounded-2xl p-6">
          <TableSkeleton rows={4} />
        </div>
      ) : students.length === 0 ? (
        <div className="backdrop-blur-md bg-slate-900/10 border border-slate-800/80 rounded-2xl py-12 text-center text-slate-550">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-slate-600" />
          <span>No students found matching current criteria.</span>
        </div>
      ) : (
        <div>
          {/* TAB 1: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <form onSubmit={handleAttendanceSubmit} className="space-y-6" noValidate>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/20 p-4 border border-slate-850 rounded-xl">
                {/* Date Picker */}
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  <label htmlFor="attendance-date" className="text-sm font-medium text-slate-350">Date:</label>
                  <div className="flex flex-col">
                    <input
                      id="attendance-date"
                      type="date"
                      required
                      value={attendanceDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className={`rounded-lg border bg-slate-950 px-3 py-1.5 text-sm text-white focus:outline-none ${
                        dateError ? 'border-red-500' : 'border-slate-800'
                      }`}
                    />
                  </div>
                </div>

                {/* Bulk Select Options */}
                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                  <button
                    type="button"
                    onClick={handleSelectAllPresent}
                    aria-label="Set all students attendance status to Present"
                    className="px-3 py-1.5 border border-slate-800 rounded-lg text-xs font-semibold bg-slate-900/40 text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    Set All Present
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllAbsent}
                    aria-label="Set all students attendance status to Absent"
                    className="px-3 py-1.5 border border-slate-800 rounded-lg text-xs font-semibold bg-slate-900/40 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    Set All Absent
                  </button>
                </div>
              </div>

              {/* Date Error Inline display */}
              {dateError && (
                <div className="text-xs text-red-400 flex items-center gap-1.5 bg-red-950/15 border border-red-500/20 p-3 rounded-lg font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{dateError}</span>
                </div>
              )}

              {/* Unmarked Warning Inline display */}
              {attendanceError && (
                <div className="text-xs text-red-400 flex items-center gap-1.5 bg-red-950/15 border border-red-500/20 p-3 rounded-lg font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{attendanceError}</span>
                </div>
              )}

              {/* Student Attendance List */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/10">
                <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                  <thead className="bg-slate-900/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Student Details</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300">
                    {students.map((student) => {
                      const status = attendanceRecords[student.id];
                      const isUnmarked = status === null;
                      
                      return (
                        <tr key={student.id} className={`hover:bg-slate-900/10 transition-colors ${isUnmarked && attendanceError ? 'bg-red-500/5' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-100">{student.user.name}</div>
                            <div className="text-xs text-slate-500">Roll: {student.rollNo}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(student.id, 'PRESENT')}
                                aria-label={`Mark ${student.user.name} as Present`}
                                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                                  status === 'PRESENT'
                                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                                    : 'border-slate-800 bg-slate-950/40 text-slate-500 hover:text-slate-400'
                                }`}
                              >
                                PRESENT
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(student.id, 'ABSENT')}
                                aria-label={`Mark ${student.user.name} as Absent`}
                                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                                  status === 'ABSENT'
                                    ? 'bg-red-600/20 border-red-500/40 text-red-400'
                                    : 'border-slate-800 bg-slate-950/40 text-slate-500 hover:text-slate-400'
                                }`}
                              >
                                ABSENT
                              </button>
                              {isUnmarked && (
                                <span className="text-[10px] text-amber-500 flex items-center gap-0.5 ml-2 font-medium">
                                  <Info className="h-3 w-3" />
                                  Unmarked
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingAttendance || !!dateError}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors shadow-lg shadow-blue-650/10"
                >
                  {savingAttendance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>Save Attendance Registry</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: MARKS */}
          {activeTab === 'marks' && (
            <form onSubmit={handleMarksSubmit} className="space-y-6" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/20 p-4 border border-slate-850 rounded-xl">
                {/* Exam Type */}
                <div className="space-y-1">
                  <label htmlFor="exam-select" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exam Type</label>
                  <select
                    id="exam-select"
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="INTERNAL1">Internal Assessment 1</option>
                    <option value="INTERNAL2">Internal Assessment 2</option>
                    <option value="SEMESTER">Semester Examinations</option>
                  </select>
                </div>

                {/* Maximum Marks */}
                <div className="space-y-1">
                  <label htmlFor="max-marks-input" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Maximum Marks</label>
                  <input
                    id="max-marks-input"
                    type="number"
                    required
                    min="10"
                    max="100"
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Student Marks Sheet Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/10">
                <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                  <thead className="bg-slate-900/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Student Details</th>
                      <th className="px-6 py-4 text-center">Marks Obtained (Max: {maxMarks})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-100">{student.user.name}</div>
                          <div className="text-xs text-slate-500">Roll: {student.rollNo}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex justify-center items-center gap-2">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max={maxMarks}
                                aria-label={`Marks obtained for ${student.user.name}`}
                                aria-invalid={!!marksErrors[student.id]}
                                placeholder="0"
                                value={marksRecords[student.id] ?? ''}
                                onChange={(e) => handleMarkChange(student.id, e.target.value)}
                                className={`w-24 text-center rounded-lg border bg-slate-950 px-3 py-1.5 text-sm text-white focus:outline-none ${
                                  marksErrors[student.id] ? 'border-red-500' : 'border-slate-850'
                                }`}
                              />
                              <span className="text-slate-500">/ {maxMarks}</span>
                            </div>
                            {marksErrors[student.id] && (
                              <span className="text-[10px] text-red-400 font-medium flex items-center gap-0.5">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                {marksErrors[student.id]}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingMarks}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors shadow-lg shadow-blue-650/10"
                >
                  {savingMarks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>Publish Exam Marks</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Visual Toast Popup */}
      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />
    </div>
  );
};

export default FacultyDashboard;
