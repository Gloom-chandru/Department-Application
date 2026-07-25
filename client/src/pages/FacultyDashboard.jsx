import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  CheckSquare, Square, Save, Calendar, Award, UserCheck, AlertCircle, Check, Loader2, ArrowRight
} from 'lucide-react';

const FacultyDashboard = () => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  
  // Selection criteria
  const [selectedBatch, setSelectedBatch] = useState('2024-28');
  const [selectedSection, setSelectedSection] = useState('A');
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' or 'marks'

  // Student list
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Attendance state
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({}); // { studentId: 'PRESENT' | 'ABSENT' }
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Marks state
  const [examType, setExamType] = useState('INTERNAL1');
  const [maxMarks, setMaxMarks] = useState(50);
  const [marksRecords, setMarksRecords] = useState({}); // { studentId: marksObtained }
  const [savingMarks, setSavingMarks] = useState(false);

  const [message, setMessage] = useState({ type: '', text: '' });
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
        showMsg('error', 'Failed to fetch your assigned subjects.');
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
        
        // Find subject to get its departmentId
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
        showMsg('error', 'Error loading students list.');
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

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const loadExistingAttendance = async (subjectId, date, studentList) => {
    try {
      const res = await api.get('/faculty/attendance/existing', {
        params: { subjectId, date },
      });
      
      const newAttendance = {};
      // Default all to PRESENT
      studentList.forEach(s => {
        newAttendance[s.id] = 'PRESENT';
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

  const handleToggleAttendance = (studentId) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'PRESENT' ? 'ABSENT' : 'PRESENT',
    }));
  };

  const handleSelectAllPresent = () => {
    const newAttendance = {};
    students.forEach(s => {
      newAttendance[s.id] = 'PRESENT';
    });
    setAttendanceRecords(newAttendance);
  };

  const handleSelectAllAbsent = () => {
    const newAttendance = {};
    students.forEach(s => {
      newAttendance[s.id] = 'ABSENT';
    });
    setAttendanceRecords(newAttendance);
  };

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSubject || students.length === 0) return;

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

      showMsg('success', `Attendance for ${attendanceDate} submitted successfully!`);
    } catch (err) {
      console.error(err);
      showMsg('error', err.response?.data?.message || 'Error recording attendance.');
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleMarkChange = (studentId, value) => {
    const parsed = value === '' ? '' : parseFloat(value);
    setMarksRecords(prev => ({
      ...prev,
      [studentId]: parsed,
    }));
  };

  const handleMarksSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSubject || students.length === 0) return;

    try {
      setSavingMarks(true);
      const records = [];
      let isInvalid = false;

      for (const student of students) {
        const val = marksRecords[student.id];
        if (val === '' || isNaN(val)) {
          showMsg('error', `Please fill in marks for all students.`);
          isInvalid = true;
          break;
        }

        if (val > maxMarks) {
          showMsg('error', `Marks entered for ${student.user.name} (${val}) exceeds maximum allowed (${maxMarks}).`);
          isInvalid = true;
          break;
        }

        records.push({
          studentId: student.id,
          marksObtained: parseFloat(val),
        });
      }

      if (isInvalid) return;

      await api.post('/faculty/marks', {
        subjectId: selectedSubject,
        examType,
        maxMarks: parseFloat(maxMarks),
        records,
      });

      showMsg('success', `Marks for ${examType} updated successfully!`);
    } catch (err) {
      console.error(err);
      showMsg('error', err.response?.data?.message || 'Error recording marks.');
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
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subject</label>
            <select
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
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Batch Year</label>
            <select
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
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Section</label>
            <select
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

      {/* ALERT MESSAGE */}
      {message.text && (
        <div className={`flex items-center gap-2.5 rounded-xl border p-4 text-sm ${
          message.type === 'success' 
            ? 'border-emerald-500/20 bg-emerald-950/15 text-emerald-400' 
            : 'border-red-500/20 bg-red-950/15 text-red-400'
        }`}>
          {message.type === 'success' ? <Check className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* TABS HEADER */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('attendance')}
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
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <span className="ml-3 text-slate-500 text-sm">Searching registries...</span>
        </div>
      ) : students.length === 0 ? (
        <div className="backdrop-blur-md bg-slate-900/10 border border-slate-800/80 rounded-2xl py-12 text-center text-slate-500">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-slate-600" />
          <span>No students found matching current criteria.</span>
        </div>
      ) : (
        <div>
          {/* TAB 1: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <form onSubmit={handleAttendanceSubmit} className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/20 p-4 border border-slate-850 rounded-xl">
                {/* Date Picker */}
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium text-slate-300">Date:</span>
                  <input
                    type="date"
                    required
                    value={attendanceDate}
                    max={new Date().toISOString().split('T')[0]} // Cannot mark future dates
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-white focus:outline-none"
                  />
                </div>

                {/* Bulk Select Options */}
                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                  <button
                    type="button"
                    onClick={handleSelectAllPresent}
                    className="px-3 py-1.5 border border-slate-800 rounded-lg text-xs font-semibold bg-slate-900/40 text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    Set All Present
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllAbsent}
                    className="px-3 py-1.5 border border-slate-800 rounded-lg text-xs font-semibold bg-slate-900/40 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    Set All Absent
                  </button>
                </div>
              </div>

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
                      const isPresent = attendanceRecords[student.id] === 'PRESENT';
                      return (
                        <tr key={student.id} className="hover:bg-slate-900/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-100">{student.user.name}</div>
                            <div className="text-xs text-slate-500">Roll: {student.rollNo} | {student.mobileNo ? `Mob: ${student.mobileNo}` : 'No Mobile'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(student.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                  isPresent
                                    ? 'bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25'
                                    : 'bg-red-600/15 border border-red-500/30 text-red-400 hover:bg-red-600/25'
                                }`}
                              >
                                {isPresent ? 'PRESENT' : 'ABSENT'}
                              </button>
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
                  disabled={savingAttendance}
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
            <form onSubmit={handleMarksSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/20 p-4 border border-slate-850 rounded-xl">
                {/* Exam Type */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exam Type</label>
                  <select
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Maximum Marks</label>
                  <input
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
                          <div className="flex justify-center items-center gap-2">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max={maxMarks}
                              placeholder="0"
                              value={marksRecords[student.id] ?? ''}
                              onChange={(e) => handleMarkChange(student.id, e.target.value)}
                              className="w-24 text-center rounded-lg border border-slate-850 bg-slate-950 px-3 py-1.5 text-sm text-white focus:outline-none"
                            />
                            <span className="text-slate-500">/ {maxMarks}</span>
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

    </div>
  );
};

export default FacultyDashboard;
