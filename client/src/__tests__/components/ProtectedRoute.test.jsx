import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';

function App({ user, loading = false }) {
  return (
    <AuthContext.Provider value={{ user, loading }}>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <div>Secret Profile</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('ProtectedRoute', () => {
  it('renders children when a user is authenticated', () => {
    render(<App user={{ _id: 'u1', name: 'Test' }} />);
    expect(screen.getByText('Secret Profile')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    render(<App user={null} />);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret Profile')).not.toBeInTheDocument();
  });

  it('shows a loader instead of redirecting while the session is loading', () => {
    render(<App user={null} loading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret Profile')).not.toBeInTheDocument();
  });
});
