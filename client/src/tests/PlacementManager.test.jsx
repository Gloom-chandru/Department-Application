import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn()
  }
}));

vi.mock('../utils/downloadHelper', () => ({
  downloadBlob: vi.fn()
}));

import api from '../utils/api';
import EligibilityReasonsPanel from '../components/EligibilityReasonsPanel';
import ApplicationStageTimeline, { StageBadge } from '../components/ApplicationStageTimeline';
import StudentPlacement from '../pages/StudentPlacement';
import FacultyPlacementView from '../pages/FacultyPlacementView';
import AdminPlacementManager from '../pages/AdminPlacementManager';

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

describe('Phase 10: Placement Management Frontend Tests', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('1. Shared components', () => {
    test('EligibilityReasonsPanel shows eligible state', () => {
      render(
        <EligibilityReasonsPanel
          eligible
          reasons={[
            { code: 'CGPA_MIN', passed: true, message: 'CGPA ok' },
            { code: 'BATCH', passed: true, message: 'Batch ok' }
          ]}
        />
      );
      expect(screen.getByText(/Eligible to apply/i)).toBeTruthy();
      expect(screen.getByText('CGPA_MIN')).toBeTruthy();
    });

    test('StageBadge and timeline render', () => {
      render(
        <>
          <StageBadge stage="SHORTLISTED" />
          <ApplicationStageTimeline
            history={[
              {
                id: 'h1',
                fromStage: 'APPLIED',
                toStage: 'SHORTLISTED',
                createdAt: new Date().toISOString(),
                actorUser: { name: 'Admin', role: 'ADMIN' },
                remarks: 'Good'
              }
            ]}
          />
        </>
      );
      expect(screen.getAllByText('SHORTLISTED').length).toBeGreaterThan(0);
      expect(screen.getByText(/Good/)).toBeTruthy();
    });
  });

  describe('2. Student Placement Portal', () => {
    beforeEach(() => {
      api.get.mockImplementation((url) => {
        if (url === '/placement/student/profile') {
          return Promise.resolve({
            data: {
              student: {
                id: 'st-1',
                rollNo: 'STU001',
                cgpa: 8.2,
                currentBacklogs: 0,
                batchYear: '2024-2028',
                department: { code: 'AIDS' },
                user: { name: 'Alice' }
              },
              profile: {
                placementStatus: 'UNPLACED',
                hasResume: true,
                skills: 'JS',
                originalResumeName: 'cv.pdf'
              },
              acceptedOffers: []
            }
          });
        }
        if (url === '/placement/student/drives') {
          return Promise.resolve({
            data: {
              data: [
                {
                  id: 'drv-1',
                  title: 'SDE',
                  location: 'Chennai',
                  status: 'PUBLISHED',
                  packageCtc: 12,
                  applicationDeadline: new Date(Date.now() + 86400000).toISOString(),
                  company: { name: 'Acme' },
                  eligible: true,
                  reasons: [{ code: 'CGPA_MIN', passed: true, message: 'ok' }],
                  application: null
                }
              ]
            }
          });
        }
        if (url === '/placement/student/applications') {
          return Promise.resolve({ data: { data: [] } });
        }
        if (url === '/placement/student/offers') {
          return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: {} });
      });
    });

    test('renders placement portal with drives', async () => {
      renderWithAuth(<StudentPlacement />, { role: 'STUDENT' });
      await waitFor(() => {
        expect(screen.getByText(/Placement Portal/i)).toBeTruthy();
      });
      expect(screen.getByText('SDE')).toBeTruthy();
      expect(screen.getByText(/Eligible/i)).toBeTruthy();
    });

    test('apply flow opens detail and posts apply', async () => {
      api.post.mockResolvedValue({ data: { id: 'app-1', stage: 'APPLIED' } });
      renderWithAuth(<StudentPlacement />, { role: 'STUDENT' });
      await waitFor(() => expect(screen.getByText('SDE')).toBeTruthy());
      fireEvent.click(screen.getByText('Details'));
      await waitFor(() => expect(screen.getByText(/Eligible to apply|Not eligible/i)).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: /^Apply$/i }));
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/placement/student/drives/drv-1/apply');
      });
    });
  });

  describe('3. Faculty Placement View', () => {
    beforeEach(() => {
      api.get.mockImplementation((url) => {
        if (url === '/placement/faculty/drives') {
          return Promise.resolve({
            data: {
              data: [
                {
                  id: 'drv-1',
                  title: 'Backend Engineer',
                  status: 'PUBLISHED',
                  company: { name: 'Acme' },
                  applicationCount: 3
                }
              ]
            }
          });
        }
        if (url.startsWith('/placement/faculty/students')) {
          return Promise.resolve({
            data: {
              data: [
                {
                  id: 'st-1',
                  rollNo: 'STU001',
                  name: 'Alice',
                  batchYear: '2024-2028',
                  cgpa: 8.1,
                  placementStatus: 'UNPLACED',
                  applicationCount: 1
                }
              ]
            }
          });
        }
        if (url.includes('/summary')) {
          return Promise.resolve({
            data: {
              title: 'Backend Engineer',
              company: { name: 'Acme' },
              counts: { cohort: 10, applied: 3, selected: 1 }
            }
          });
        }
        return Promise.resolve({ data: {} });
      });
    });

    test('shows read-only overview without mutate controls', async () => {
      renderWithAuth(<FacultyPlacementView />, { role: 'FACULTY' });
      await waitFor(() => {
        expect(screen.getByText(/Department Placement Overview/i)).toBeTruthy();
      });
      expect(screen.getByText('Backend Engineer')).toBeTruthy();
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.queryByText(/Create offer/i)).toBeNull();
      expect(screen.getByText(/Resumes and individual CTC are hidden/i)).toBeTruthy();
    });
  });

  describe('4. Admin Placement Manager', () => {
    beforeEach(() => {
      api.get.mockImplementation((url) => {
        if (url === '/admin/departments') {
          return Promise.resolve({ data: [{ id: 'd1', code: 'AIDS', name: 'AIDS' }] });
        }
        if (url.startsWith('/placement/admin/companies')) {
          return Promise.resolve({ data: { data: [{ id: 'c1', name: 'Acme', code: 'ACME', isActive: true }] } });
        }
        if (url.startsWith('/placement/admin/drives')) {
          return Promise.resolve({
            data: {
              data: [
                {
                  id: 'drv-1',
                  title: 'SDE',
                  status: 'DRAFT',
                  company: { name: 'Acme' },
                  _count: { applications: 0 }
                }
              ]
            }
          });
        }
        if (url.startsWith('/placement/admin/analytics/summary')) {
          return Promise.resolve({
            data: {
              cohortSize: 100,
              placed: 20,
              placementPercent: 20,
              applications: 40,
              packageStats: { avg: 10 }
            }
          });
        }
        if (url.includes('/by-company')) {
          return Promise.resolve({ data: { data: [{ companyId: 'c1', companyName: 'Acme', selectedApplications: 2, acceptedOffers: 1, avgCtc: 12 }] } });
        }
        if (url.includes('/by-department')) {
          return Promise.resolve({ data: { data: [{ code: 'AIDS', placementPercent: 20, placed: 5 }] } });
        }
        if (url.includes('/by-batch')) {
          return Promise.resolve({ data: { data: [{ batchYear: '2024-2028', placed: 5 }] } });
        }
        if (url.includes('/packages')) {
          return Promise.resolve({
            data: { highest: 20, avg: 12, median: 11, lowest: 6, acceptedCount: 5 }
          });
        }
        if (url.startsWith('/placement/admin/offers')) {
          return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: {} });
      });
      api.post.mockResolvedValue({ data: { id: 'x', status: 'PUBLISHED' } });
    });

    test('renders analytics and can publish draft drive', async () => {
      renderWithAuth(<AdminPlacementManager />, { role: 'ADMIN' });
      await waitFor(() => {
        expect(screen.getByText(/Placement Management/i)).toBeTruthy();
      });
      expect(screen.getByText(/Placement %/i)).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /Drives/i }));
      await waitFor(() => expect(screen.getByText('SDE')).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: /Publish/i }));
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/placement/admin/drives/drv-1/publish');
      });
    });
  });
});
