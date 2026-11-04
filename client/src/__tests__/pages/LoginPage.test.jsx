import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import LoginPage from '../../pages/LoginPage';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const renderLogin = (authOverrides = {}) => {
  const auth = {
    login: vi.fn(),
    beginTwoFactorSetup: vi.fn(),
    completeTwoFactorSetup: vi.fn(),
    ...authOverrides,
  };
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
  return auth;
};

const submitLogin = (email = 'admin@freshmart.com', password = 'admin12345') => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: /^login$/i }));
};

describe('LoginPage two-factor enrolment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the enrolment panel when login reports 2FA setup is required', async () => {
    const auth = renderLogin({
      login: vi
        .fn()
        .mockResolvedValue({ success: false, twoFactorSetupRequired: true }),
      beginTwoFactorSetup: vi.fn().mockResolvedValue({
        success: true,
        secret: 'ABCDEF',
        qrDataUrl: 'data:image/png;base64,xyz',
      }),
    });

    submitLogin();

    expect(
      await screen.findByText(/set up two-factor authentication/i)
    ).toBeInTheDocument();
    expect(auth.beginTwoFactorSetup).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByAltText(/two-factor authentication qr code/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/ABCDEF/)).toBeInTheDocument();
  });

  it('enables 2FA, shows recovery codes, then continues', async () => {
    const auth = renderLogin({
      login: vi
        .fn()
        .mockResolvedValue({ success: false, twoFactorSetupRequired: true }),
      beginTwoFactorSetup: vi.fn().mockResolvedValue({
        success: true,
        secret: 'ABCDEF',
        qrDataUrl: 'data:image/png;base64,xyz',
      }),
      completeTwoFactorSetup: vi.fn().mockResolvedValue({
        success: true,
        recoveryCodes: ['aaaa-bbbb', 'cccc-dddd'],
      }),
    });

    submitLogin();
    await screen.findByText(/set up two-factor authentication/i);

    fireEvent.change(screen.getByLabelText('Authentication code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enable and sign in/i }));

    await waitFor(() =>
      expect(auth.completeTwoFactorSetup).toHaveBeenCalledWith('123456')
    );
    expect(await screen.findByText(/save your recovery codes/i)).toBeInTheDocument();
    expect(screen.getByText('aaaa-bbbb')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('shows an error and stays on the form for invalid credentials', async () => {
    const auth = renderLogin({
      login: vi.fn().mockResolvedValue({
        success: false,
        message: 'Invalid credentials',
      }),
    });

    submitLogin('admin@freshmart.com', 'wrong');

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(auth.beginTwoFactorSetup).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
  });
});
