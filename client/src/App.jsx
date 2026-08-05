import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import NotificationsPage from './pages/NotificationsPage';
import StudentRequests from './pages/StudentRequests';
import FacultyReview from './pages/FacultyReview';
import AdminRequestsOverview from './pages/AdminRequestsOverview';
import StudentTimetable from './pages/StudentTimetable';
import FacultySchedule from './pages/FacultySchedule';
import AdminTimetableManager from './pages/AdminTimetableManager';
import AdminBulkImportManager from './pages/AdminBulkImportManager';
import FacultyRiskView from './pages/FacultyRiskView';
import AdminRiskAnalytics from './pages/AdminRiskAnalytics';
import StudentPlacement from './pages/StudentPlacement';
import AdminPlacementManager from './pages/AdminPlacementManager';
import FacultyPlacementView from './pages/FacultyPlacementView';
import NotFound from './pages/NotFound';

// Route Guard for authenticated paths & optional role check
const PrivateRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090d16]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-blue-500"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Dispatcher that loads the appropriate dashboard depending on the user's role
const DashboardDispatcher = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'STUDENT':
      return <StudentDashboard />;
    case 'FACULTY':
      return <FacultyDashboard />;
    case 'ADMIN':
      return <AdminDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public route — no layout shell */}
              <Route path="/login" element={<Login />} />

              {/* All protected routes wrapped in the enterprise Layout */}
              <Route
                path="/*"
                element={
                  <PrivateRoute>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<DashboardDispatcher />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/notifications" element={<NotificationsPage />} />
                        <Route path="/requests" element={<StudentRequests />} />
                        <Route path="/review" element={<FacultyReview />} />
                        <Route path="/timetable" element={<StudentTimetable />} />
                        <Route path="/schedule" element={<FacultySchedule />} />
                        <Route
                          path="/admin/requests"
                          element={
                            <PrivateRoute>
                              <AdminRequestsOverview />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/admin/timetable"
                          element={
                            <PrivateRoute roles={['ADMIN']}>
                              <AdminTimetableManager />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/admin/bulk"
                          element={
                            <PrivateRoute roles={['ADMIN']}>
                              <AdminBulkImportManager />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/faculty/risk"
                          element={
                            <PrivateRoute roles={['FACULTY', 'ADMIN']}>
                              <FacultyRiskView />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/admin/risk"
                          element={
                            <PrivateRoute roles={['ADMIN']}>
                              <AdminRiskAnalytics />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/student/placement"
                          element={
                            <PrivateRoute roles={['STUDENT']}>
                              <StudentPlacement />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/admin/placement"
                          element={
                            <PrivateRoute roles={['ADMIN']}>
                              <AdminPlacementManager />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/faculty/placement"
                          element={
                            <PrivateRoute roles={['FACULTY']}>
                              <FacultyPlacementView />
                            </PrivateRoute>
                          }
                        />
                        {/* 404 Catch-all */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Layout>
                  </PrivateRoute>
                }
              />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
