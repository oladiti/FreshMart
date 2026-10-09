import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext, AuthProvider } from '../../context/AuthContext';

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import api from '../../utils/api';

const mockUser = {
  _id: 'u1',
  name: 'Test User',
  email: 'user@test.com',
  role: 'user',
  token: 'fake-token',
};

function TestHarness() {
  return (
    <AuthContext.Consumer>
      {({ user, login, register, logout, updateProfile }) => (
        <div>
          <span data-testid="user">
            {user ? `${user.name}:${user.email}` : 'no-user'}
          </span>
          <button onClick={() => register('New User', 'new@test.com', 'password123')}>
            register
          </button>
          <button onClick={() => login('login@test.com', 'password123')}>login</button>
          <button onClick={() => updateProfile({ name: 'Updated' })}>update</button>
          <button onClick={logout}>logout</button>
        </div>
      )}
    </AuthContext.Consumer>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('loads a stored user from localStorage on mount', async () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User:user@test.com');
    });
  });

  it('has no user initially when localStorage is empty', async () => {
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('no-user');
    });
  });

  it('registers a user and persists token + user', async () => {
    api.post.mockResolvedValue({ data: mockUser });
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    fireEvent.click(screen.getByText('register'));
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User:user@test.com');
    });
    expect(localStorage.getItem('token')).toBe('fake-token');
    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      name: 'New User',
      email: 'new@test.com',
      password: 'password123',
    });
  });

  it('returns a failure message when registration errors', async () => {
    api.post.mockRejectedValue({
      response: { data: { message: 'User already exists' } },
    });
    let result;
    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {({ register }) => (
            <button
              onClick={async () => {
                result = await register('X', 'x@test.com', 'password123');
              }}
            >
              doRegister
            </button>
          )}
        </AuthContext.Consumer>
      </AuthProvider>
    );
    fireEvent.click(screen.getByText('doRegister'));
    await waitFor(() => {
      expect(result).toEqual({ success: false, message: 'User already exists' });
    });
  });

  it('logs in a user and updates state', async () => {
    api.post.mockResolvedValue({ data: mockUser });
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User:user@test.com');
    });
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'login@test.com',
      password: 'password123',
    });
  });

  it('logs out and clears the user', async () => {
    localStorage.setItem('token', 'tok');
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    await waitFor(() => {
      fireEvent.click(screen.getByText('logout'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('no-user');
    });
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('updates the profile and merges into user state', async () => {
    api.put.mockResolvedValue({ data: { name: 'Updated', email: 'user@test.com', role: 'user' } });
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    localStorage.setItem('token', 'tok');
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    await waitFor(() => {
      fireEvent.click(screen.getByText('update'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Updated:user@test.com');
    });
  });
});
