import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

// Mock api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  }
}));

import api from '../utils/api';
import AcademicHealthCard from '../components/AcademicHealthCard';
import FacultyRiskView from '../pages/FacultyRiskView';
import AdminRiskAnalytics from '../pages/AdminRiskAnalytics';

const renderWithAuth = (component, userOverride = {}) => {
  const user = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@user.com',
    role: 'STUDENT',
    ...userOverride
  };

  return render(
    <AuthContext.Provider value={{ user, loading: false, login: vi.fn(), logout: vi.fn() }}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('Phase 9: Academic Risk & Early-Warning Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/risk/student/me') {
        return Promise.resolve({
          data: {
            studentId: 'st-1',
            riskScore: 25,
            riskLevel: 'LOW',
            attendanceScore: 10,
            marksScore: 15,
            assignmentScore: 0,
            progressionScore: 0,
            dataCompleteness: 100,
            confidenceLevel: 'HIGH',
            factors: [],
            recommendations: ['Maintain current attendance rhythm.'],
          }
        });
      }
      if (url === '/risk/faculty/students') {
        return Promise.resolve({
          data: {
            summary: { total: 2, high: 1, medium: 0, low: 1 },
            subjects: [{ id: 'sub-1', code: 'CS101', name: 'Data Structures' }],
            students: [
              { studentId: 'st-1', name: 'Alice', rollNo: 'STU001', batchYear: '2024-28', section: 'A', riskScore: 75, riskLevel: 'HIGH', attendanceScore: 70, marksScore: 80, dataCompleteness: 100, confidenceLevel: 'HIGH' },
              { studentId: 'st-2', name: 'Bob', rollNo: 'STU002', batchYear: '2024-28', section: 'A', riskScore: 10, riskLevel: 'LOW', attendanceScore: 0, marksScore: 10, dataCompleteness: 100, confidenceLevel: 'HIGH' }
            ]
          }
        });
      }
      if (url === '/risk/admin/summary') {
        return Promise.resolve({
          data: {
            counters: { totalStudents: 10, assessedStudents: 10, averageRiskScore: 35 },
            distribution: { HIGH: 2, MEDIUM: 3, LOW: 5 },
            departmentBenchmarks: [{ id: 'd1', code: 'AIDS', name: 'AIDS Dept', studentCount: 10, averageRiskScore: 35 }],
            topFactorCategories: [{ category: 'ATTENDANCE', count: 4 }]
          }
        });
      }
      if (url === '/risk/admin/students') {
        return Promise.resolve({
          data: {
            students: [
              { studentId: 'st-1', name: 'Alice', rollNo: 'STU001', department: 'AIDS', batchYear: '2024-28', section: 'A', riskScore: 75, riskLevel: 'HIGH', confidenceLevel: 'HIGH' }
            ]
          }
        });
      }
      if (url === '/admin/departments') {
        return Promise.resolve({ data: [{ id: 'd1', code: 'AIDS', name: 'AIDS Dept' }] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    cleanup();
  });

  // =====================================================
  // 1. ACADEMIC HEALTH CARD (STUDENT)
  // =====================================================
  describe('1. AcademicHealthCard', () => {
    test('Renders Good Standing badge for LOW risk score', async () => {
      renderWithAuth(<AcademicHealthCard />);
      await waitFor(() => {
        expect(screen.getByText('Good Standing')).toBeInTheDocument();
        expect(screen.getByText(/Academic Health & Early Warning Summary/i)).toBeInTheDocument();
      });
    });

    test('Renders recommendations and confidence indicator', async () => {
      renderWithAuth(<AcademicHealthCard />);
      await waitFor(() => {
        expect(screen.getByText(/Maintain current attendance rhythm/i)).toBeInTheDocument();
        expect(screen.getByText(/Confidence:/i)).toBeInTheDocument();
      });
    });
  });

  // =====================================================
  // 2. FACULTY RISK VIEW
  // =====================================================
  describe('2. FacultyRiskView', () => {
    test('Renders summary counters and student risk roster', async () => {
      renderWithAuth(<FacultyRiskView />, { role: 'FACULTY' });
      await waitFor(() => {
        expect(screen.getByText('Faculty Academic Attention Portal')).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('HIGH (75)')).toBeInTheDocument();
      });
    });

    test('Filtering by subject triggers API call with params', async () => {
      renderWithAuth(<FacultyRiskView />, { role: 'FACULTY' });

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      const select = screen.getByDisplayValue(/All Assigned Subjects/i);
      fireEvent.change(select, { target: { value: 'sub-1' } });

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/risk/faculty/students', expect.objectContaining({ params: { subjectId: 'sub-1' } }));
      });
    });
  });

  // =====================================================
  // 3. ADMIN RISK ANALYTICS
  // =====================================================
  describe('3. AdminRiskAnalytics', () => {
    test('Renders dashboard charts & recalculate button', async () => {
      renderWithAuth(<AdminRiskAnalytics />, { role: 'ADMIN' });

      await waitFor(() => {
        expect(screen.getByText('Academic Risk & Early-Warning Control Hub')).toBeInTheDocument();
        expect(screen.getByText('Recalculate Cohort Risk')).toBeInTheDocument();
        expect(screen.getByText('Risk Level Distribution')).toBeInTheDocument();
      });
    });

    test('Recalculate button triggers API call', async () => {
      api.post.mockResolvedValue({ data: { message: 'Recalculation complete.', count: 10 } });

      renderWithAuth(<AdminRiskAnalytics />, { role: 'ADMIN' });

      await waitFor(() => {
        expect(screen.getByText('Recalculate Cohort Risk')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Recalculate Cohort Risk'));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/risk/admin/recalculate', {});
      });
    });
  });
});
