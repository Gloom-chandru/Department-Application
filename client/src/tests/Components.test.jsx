import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import Login from '../pages/Login';
import Profile from '../pages/Profile';

// Mock Router Navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Frontend Component Tests', () => {
  
  describe('1. Login Component', () => {
    test('renders inputs and submit button', () => {
      const mockLogin = vi.fn();
      
      render(
        <AuthContext.Provider value={{ login: mockLogin, user: null, loading: false }}>
          <BrowserRouter>
            <Login />
          </BrowserRouter>
        </AuthContext.Provider>
      );

      // Verify page title and header
      expect(screen.getByText('VIT Student Portal')).toBeInTheDocument();
      expect(screen.getByText('Velammal Institute of Technology')).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });

    test('validates submission attempts', async () => {
      const mockLogin = vi.fn();
      
      render(
        <AuthContext.Provider value={{ login: mockLogin, user: null, loading: false }}>
          <BrowserRouter>
            <Login />
          </BrowserRouter>
        </AuthContext.Provider>
      );

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passwordInput = screen.getByLabelText(/Password/i);
      const submitButton = screen.getByRole('button', { name: /Sign In/i });

      // Change values
      fireEvent.change(emailInput, { target: { value: 'test@student.velammal.edu.in' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      
      // Submit
      fireEvent.click(submitButton);

      // Check if login mock was triggered
      expect(mockLogin).toHaveBeenCalledWith('test@student.velammal.edu.in', 'password123');
    });
  });

  describe('2. Profile Component', () => {
    test('renders student profile information correctly', async () => {
      const mockUser = {
        id: '123',
        name: 'Santhosh Kumar C',
        email: 'santhosh.c@student.velammal.edu.in',
        role: 'STUDENT',
        department: { id: 'dept-id', name: 'Artificial Intelligence and Data Science', code: 'AIDS' },
      };

      // Mock API call in Profile
      vi.mock('../utils/api', () => {
        return {
          default: {
            get: () => Promise.resolve({
              data: {
                rollNo: '2024AIDS001',
                batchYear: '2024-28',
                section: 'A',
                mobileNo: '9876543210',
                guardianContact: '9876543211',
                user: { name: 'Santhosh Kumar C', email: 'santhosh.c@student.velammal.edu.in', createdAt: '2026-07-25T08:00:00Z' },
                department: { name: 'Artificial Intelligence and Data Science', code: 'AIDS' }
              }
            })
          }
        };
      });

      render(
        <AuthContext.Provider value={{ user: mockUser, loading: false }}>
          <Profile />
        </AuthContext.Provider>
      );

      // Verify profile title card
      expect(await screen.findByText('Santhosh Kumar C')).toBeInTheDocument();
      expect(await screen.findByText('santhosh.c@student.velammal.edu.in')).toBeInTheDocument();
      
      // Verify enrollment details
      expect(await screen.findByText('2024AIDS001')).toBeInTheDocument();
      expect(await screen.findByText('2024-28')).toBeInTheDocument();
      expect(await screen.findByText('Section A')).toBeInTheDocument();
    });
  });
});
