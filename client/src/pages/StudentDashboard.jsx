import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  AlertTriangle, BookOpen, Calendar, Award, Bell, Check, Printer, FileText, Loader2, Briefcase
} from 'lucide-react';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { Toast, Button, Badge } from '../components/ui';
import AcademicHealthCard from '../components/AcademicHealthCard';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [marks, setMarks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, attendanceRes, marksRes, notifRes] = await Promise.all([
        api.get('/student/profile'),
        api.get('/student/attendance'),
        api.get('/student/marks'),
        api.get('/student/notifications'),
      ]);

      setProfile(profileRes.data);
      setAttendance(attendanceRes.data);
      setMarks(marksRes.data);
      setNotifications(notifRes.data);
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage('Failed to sync student data from portal servers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/student/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, readStatus: true } : n)
      );
      setToastType('success');
      setToastMessage('Notification acknowledged.');
    } catch (err) {
      console.error('Error marking notification read:', err);
      setToastType('error');
      setToastMessage('Failed to acknowledge notification.');
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  if (loading) {
    // Show premium skeleton loading state instead of a spinner
    return (
      <div className="space-y-8">
        <div className="h-8 w-64 bg-bg-sidebar rounded animate-pulse mb-6"></div>
        <DashboardSkeleton />
      </div>
    );
  }

  const { overall, subjectWise } = attendance || { overall: { percentage: 100, total: 0, present: 0, threshold: 75, isLow: false }, subjectWise: [] };

  return (
    <div className="space-y-8 print:p-0">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-app pb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-main mb-1">
            Welcome back, {profile?.user.name}
          </h1>
          <p className="text-text-muted text-sm">
            Roll Number: <span className="text-text-main font-semibold">{profile?.rollNo}</span> | Section: <span className="text-text-main font-semibold">{profile?.section}</span> | Batch: <span className="text-text-main font-semibold">{profile?.batchYear}</span>
          </p>
        </div>
        <button
          onClick={triggerPrint}
          type="button"
          aria-label="Print academic transcript and attendance report card"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border-card bg-bg-sidebar text-text-main hover:text-white hover:bg-bg-input hover:border-border-card transition-all font-medium text-sm"
        >
          <Printer className="h-4 w-4" />
          <span>Print Report Card</span>
        </button>
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block border-b-2 border-border-card pb-4 mb-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold uppercase text-black">Velammal Institute of Technology</h1>
          <p className="text-sm text-text-muted uppercase tracking-widest font-semibold">Department of Artificial Intelligence & Data Science</p>
          <h2 className="text-lg font-bold mt-4 text-black underline">ACADEMIC PERFORMANCE REPORT</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6 text-sm text-black">
          <div>
            <p><strong>Student Name:</strong> {profile?.user.name}</p>
            <p><strong>Roll Number:</strong> {profile?.rollNo}</p>
          </div>
          <div>
            <p><strong>Batch / Year:</strong> {profile?.batchYear}</p>
            <p><strong>Section:</strong> {profile?.section}</p>
          </div>
        </div>
      </div>

      {/* LOW ATTENDANCE ALERT BANNER */}
      {overall.isLow && (
        <div 
          role="alert" 
          className="flex items-start gap-4 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-red-300 animate-pulse print:hidden"
        >
          <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-400">Attendance Warning!</h3>
            <p className="text-sm mt-1">
              Your overall attendance is <strong className="text-text-main">{overall.percentage}%</strong>, which is below the minimum required threshold of <strong className="text-text-main">{overall.threshold}%</strong>. Please contact your Class Advisor immediately to prevent academic penalties.
            </p>
          </div>
        </div>
      )}

      {/* ACADEMIC HEALTH & RISK CARD */}
      <AcademicHealthCard />

      <a
        href="/student/placement"
        className="flex items-center justify-between rounded-2xl border border-border-app bg-bg-card/40 px-5 py-4 print:hidden hover:border-blue-500/40 transition-colors"
      >
        <div>
          <h3 className="text-sm font-semibold text-text-main">Placement & Career Portal</h3>
          <p className="text-xs text-text-muted mt-0.5">View eligible drives, applications, and offers</p>
        </div>
        <Briefcase className="h-5 w-5 text-blue-400" />
      </a>

      {/* ATTENDANCE SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Circular Progress Ring Card */}
        <div className="backdrop-blur-md bg-bg-card/30 border border-border-app rounded-2xl p-6 flex flex-col items-center justify-center text-center print:border-slate-300 print:bg-white print:text-black">
          <h2 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2 print:text-black">
            <Calendar className="h-5 w-5 text-blue-500 print:text-black" />
            Overall Attendance
          </h2>
          
          <div className="relative flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-36 h-36 transform -rotate-90" aria-label={`Circular progress bar representing overall attendance: ${overall.percentage}%`}>
              <circle
                cx="72"
                cy="72"
                r="64"
                className="stroke-slate-800 print:stroke-slate-200"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="64"
                className={`transition-all duration-500 ${overall.isLow ? 'stroke-red-500' : 'stroke-emerald-500'} print:stroke-black`}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray="402.1"
                strokeDashoffset={402.1 - (402.1 * overall.percentage) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-text-main print:text-black">{overall.percentage}%</span>
              <span className="text-[10px] text-text-muted uppercase tracking-widest mt-0.5 print:text-text-muted">Present</span>
            </div>
          </div>

          <div className="mt-6 flex justify-between w-full text-sm text-text-muted border-t border-border-app/60 pt-4 px-2 print:border-slate-200 print:text-black">
            <div className="flex flex-col items-center">
              <span className="text-xs text-text-muted print:text-text-muted">Total Classes</span>
              <span className="font-bold text-text-main mt-0.5 print:text-black">{overall.total}</span>
            </div>
            <div className="w-px bg-bg-sidebar print:bg-slate-200"></div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-text-muted print:text-text-muted">Attended</span>
              <span className="font-bold text-emerald-400 mt-0.5 print:text-black">{overall.present}</span>
            </div>
            <div className="w-px bg-bg-sidebar print:bg-slate-200"></div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-text-muted print:text-text-muted">Threshold</span>
              <span className="font-bold text-text-main mt-0.5 print:text-black">{overall.threshold}%</span>
            </div>
          </div>
        </div>

        {/* Recharts Bar Chart Card */}
        <div className="lg:col-span-2 backdrop-blur-md bg-bg-card/30 border border-border-app rounded-2xl p-6 flex flex-col print:hidden">
          <h2 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Subject Attendance (%)
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={subjectWise}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="subjectCode" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#f8fafc' }}
                />
                <ReferenceLine y={overall.threshold} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Req 75%', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }} />
                <Bar 
                  dataKey="percentage" 
                  name="Attendance %"
                  radius={[6, 6, 0, 0]}
                  fill="#3b82f6"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* MARKS AND RESULTS TABLE */}
      <div className="backdrop-blur-md bg-bg-card/30 border border-border-app rounded-2xl p-6 print:border-slate-300 print:bg-white print:text-black">
        <h2 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2 print:text-black">
          <Award className="h-5 w-5 text-blue-500 print:text-black" />
          Academic Marks Transcript
        </h2>

        <div className="overflow-x-auto rounded-xl border border-border-app/80 print:border-slate-200">
          <table className="min-w-full divide-y divide-slate-800 print:divide-slate-200 text-left text-sm">
            <thead className="bg-bg-card/50 print:bg-slate-100 text-xs font-semibold uppercase tracking-wider text-text-muted print:text-black">
              <tr>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4 text-center">Internal 1 (Max 50)</th>
                <th className="px-6 py-4 text-center">Internal 2 (Max 50)</th>
                <th className="px-6 py-4 text-center">Semester Exam (Max 100)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 print:divide-slate-200 text-text-main print:text-black">
              {marks.map((subMark) => (
                <tr key={subMark.subjectCode} className="hover:bg-bg-card/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-100 print:text-black">{subMark.subjectName}</div>
                    <div className="text-xs text-text-muted print:text-text-muted">{subMark.subjectCode}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    {subMark.marks.INTERNAL1 ? (
                      <div>
                        <span className="text-white print:text-black">{subMark.marks.INTERNAL1.obtained}</span>
                        <span className="text-text-muted text-xs"> / 50</span>
                        <div className="text-[10px] text-text-muted">{subMark.marks.INTERNAL1.percentage}%</div>
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    {subMark.marks.INTERNAL2 ? (
                      <div>
                        <span className="text-white print:text-black">{subMark.marks.INTERNAL2.obtained}</span>
                        <span className="text-text-muted text-xs"> / 50</span>
                        <div className="text-[10px] text-text-muted">{subMark.marks.INTERNAL2.percentage}%</div>
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    {subMark.marks.SEMESTER ? (
                      <div>
                        <span className="text-white print:text-black font-semibold">{subMark.marks.SEMESTER.obtained}</span>
                        <span className="text-text-muted text-xs"> / 100</span>
                        <div className={`text-[10px] font-semibold ${subMark.marks.SEMESTER.obtained >= 50 ? 'text-emerald-400' : 'text-red-400'} print:text-black`}>
                          {subMark.marks.SEMESTER.obtained >= 50 ? 'PASS' : 'FAIL'} ({subMark.marks.SEMESTER.percentage}%)
                        </div>
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {marks.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-text-muted">
                    No marks records published yet for this semester.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NOTIFICATIONS SECTION */}
      <div className="backdrop-blur-md bg-bg-card/30 border border-border-app rounded-2xl p-6 print:hidden">
        <h2 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-500" />
          Alerts & Notifications
        </h2>

        <div className="space-y-3">
          {notifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                notif.readStatus 
                  ? 'border-border-app bg-bg-app/20 text-text-muted' 
                  : 'border-blue-900/30 bg-blue-950/15 text-text-main'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {notif.type === 'ATTENDANCE_WARNING' ? (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                ) : (
                  <FileText className="h-5 w-5 text-blue-500" />
                )}
              </div>
              
              <div className="flex-1">
                <p className="text-sm">{notif.message}</p>
                <div className="mt-2 text-[10px] text-text-muted flex items-center gap-2">
                  <span>{new Date(notif.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  <span>•</span>
                  <span>{new Date(notif.createdAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}</span>
                </div>
              </div>

              {!notif.readStatus && (
                <button 
                  type="button"
                  onClick={() => handleMarkAsRead(notif.id)}
                  aria-label={`Acknowledge notification: ${notif.message.slice(0, 30)}...`}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-text-main transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Acknowledge</span>
                </button>
              )}
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="text-center py-6 text-text-muted text-sm">
              You are all caught up! No active warnings or alerts.
            </div>
          )}
        </div>
      </div>

      {/* Toast Alert Popups */}
      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />
    </div>
  );
};

export default StudentDashboard;
