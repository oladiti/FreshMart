import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext, AuthProvider } from '../../context/AuthContext';

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  hasSessionHint: vi.fn(() => true),
}));

import api, { hasSessionHint } from '../../utils/api';

// The server no longer returns a token in the body; auth rides on HttpOnly
// cookies. This mock user mirrors the cookie-session profile payload.
const mockUser = {
  _id: 'u1',
  name: 'Test User',
  email: 'user@test.com',
  role: 'user',
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
    // Default: a session is present (readable CSRF cookie) and the profile
    // request 401s unless a test overrides it.
    hasSessionHint.mockReturnValue(true);
    api.get.mockRejectedValue({ response: { status: 401 } });
  });

  it('hydrates the user from the session cookie via /auth/profile', async () => {
    api.get.mockResolvedValue({ data: mockUser });
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User:user@test.com');
    });
    expect(api.get).toHaveBeenCalledWith('/auth/profile');
  });

  it('has no user when the session is invalid', async () => {
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('no-user');
    });
  });

  it('skips the profile probe for guests (no session hint, no cache)', async () => {
    hasSessionHint.mockReturnValue(false);
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('no-user');
    });
    expect(api.get).not.toHaveBeenCalled();
  });

  it('probes the profile when a cached user exists even without a hint', async () => {
    hasSessionHint.mockReturnValue(false);
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    api.get.mockResolvedValue({ data: mockUser });
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User:user@test.com');
    });
    expect(api.get).toHaveBeenCalledWith('/auth/profile');
  });

  it('registers a user without persisting any token', async () => {
    api.post.mockResolvedValue({ data: { ...mockUser, token: 'ignored' } });
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    fireEvent.click(screen.getByText('register'));
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User:user@test.com');
    });
    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      name: 'New User',
      email: 'new@test.com',
      password: 'password123',
    });
    expect(localStorage.getItem('token')).toBeNull();
    const cached = JSON.parse(localStorage.getItem('currentUser'));
    expect(cached.token).toBeUndefined();
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

  it('returns verification metadata to the caller on success', async () => {
    api.post.mockResolvedValue({
      data: {
        ...mockUser,
        token: 'ignored',
        verificationSent: true,
        devVerifyLink: null,
      },
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
      expect(result).toMatchObject({
        success: true,
        verificationSent: true,
        devVerifyLink: null,
      });
    });
    expect(result.data.token).toBeUndefined();
    expect(result.data.verificationSent).toBeUndefined();
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

  it('logs out via the API and clears the user', async () => {
    api.get.mockResolvedValue({ data: mockUser });
    api.post.mockResolvedValue({ data: { message: 'Logged out' } });
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User:user@test.com');
    });
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('no-user');
    });
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('updates the profile and merges into user state', async () => {
    api.get.mockResolvedValue({ data: mockUser });
    api.put.mockResolvedValue({
      data: { name: 'Updated', email: 'user@test.com', role: 'user' },
    });
    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User:user@test.com');
    });
    fireEvent.click(screen.getByText('update'));
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Updated:user@test.com');
    });
  });

  it('surfaces twoFactorSetupRequired when an admin must enrol in 2FA', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 403,
        data: {
          message: 'Two-factor authentication must be enabled before signing in.',
          twoFactorSetupRequired: true,
        },
      },
    });
    let result;
    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {({ login }) => (
            <button
              onClick={async () => {
                result = await login('admin@test.com', 'admin12345');
              }}
            >
              doLogin
            </button>
          )}
        </AuthContext.Consumer>
      </AuthProvider>
    );
    fireEvent.click(screen.getByText('doLogin'));
    await waitFor(() => {
      expect(result).toMatchObject({
        success: false,
        twoFactorSetupRequired: true,
      });
    });
  });

  it('begins 2FA setup and returns the QR/secret payload', async () => {
    api.post.mockResolvedValue({
      data: {
        secret: 'ABCDEF',
        otpauthUrl: 'otpauth://totp/x',
        qrDataUrl: 'data:image/png;base64,xyz',
      },
    });
    let result;
    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {({ beginTwoFactorSetup }) => (
            <button
              onClick={async () => {
                result = await beginTwoFactorSetup();
              }}
            >
              doBegin
            </button>
          )}
        </AuthContext.Consumer>
      </AuthProvider>
    );
    fireEvent.click(screen.getByText('doBegin'));
    await waitFor(() => {
      expect(result).toMatchObject({
        success: true,
        secret: 'ABCDEF',
        qrDataUrl: 'data:image/png;base64,xyz',
      });
    });
    expect(api.post).toHaveBeenCalledWith('/auth/2fa/setup');
  });

  it('completes 2FA setup, loads the profile and returns recovery codes', async () => {
    api.post.mockResolvedValue({
      data: { twoFactorEnabled: true, recoveryCodes: ['aaaa', 'bbbb'] },
    });
    api.get.mockResolvedValue({ data: mockUser });
    let result;
    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {({ completeTwoFactorSetup }) => (
            <button
              onClick={async () => {
                result = await completeTwoFactorSetup('123456');
              }}
            >
              doComplete
            </button>
          )}
        </AuthContext.Consumer>
      </AuthProvider>
    );
    fireEvent.click(screen.getByText('doComplete'));
    await waitFor(() => {
      expect(result).toMatchObject({
        success: true,
        recoveryCodes: ['aaaa', 'bbbb'],
      });
    });
    expect(api.post).toHaveBeenCalledWith('/auth/2fa/enable', { code: '123456' });
    expect(api.get).toHaveBeenCalledWith('/auth/profile');
    expect(JSON.parse(localStorage.getItem('currentUser')).email).toBe(
      'user@test.com'
    );
  });

  it('returns an error message when the 2FA code is rejected', async () => {
    api.post.mockRejectedValue({
      response: { data: { message: 'Invalid authentication code' } },
    });
    let result;
    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {({ completeTwoFactorSetup }) => (
            <button
              onClick={async () => {
                result = await completeTwoFactorSetup('000000');
              }}
            >
              doComplete
            </button>
          )}
        </AuthContext.Consumer>
      </AuthProvider>
    );
    fireEvent.click(screen.getByText('doComplete'));
    await waitFor(() => {
      expect(result).toEqual({
        success: false,
        message: 'Invalid authentication code',
      });
    });
  });
});
