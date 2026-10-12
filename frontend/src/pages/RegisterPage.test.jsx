import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import RegisterPage from './RegisterPage';

function renderRegistrationPage() {
  render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<h1>Account created</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

async function fillRegistrationForm(user) {
  await user.type(screen.getByLabelText(/full name/i), 'Jordan Rivers');
  await user.type(screen.getByLabelText(/email/i), 'jordan@example.com');
  await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123');
  await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123');
}

function apiResponse(body, status = 400) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('registration page', () => {
  it('shows a single centered registration card without the promotional panel', () => {
    renderRegistrationPage();

    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.queryByText(/build your secure environment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/accelerated onboarding/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/access policy/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
  });

  it('preserves successful registration and navigates to the dashboard', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({
      user: { email: 'jordan@example.com' },
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    }, 201)));
    renderRegistrationPage();

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByRole('heading', { name: /account created/i })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Jordan Rivers',
        email: 'jordan@example.com',
        password: 'StrongPass123',
        password_confirm: 'StrongPass123',
      }),
    }));
  });

  it('keeps the pending state and prevents duplicate submissions', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    renderRegistrationPage();

    await fillRegistrationForm(user);
    const registerButton = screen.getByRole('button', { name: /register/i });
    await user.click(registerButton);

    expect(await screen.findByRole('button', { name: /creating account/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /creating account/i }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows the backend duplicate-email message in an accessible alert', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({ detail: 'Email already registered.' })));
    renderRegistrationPage();

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered.');
  });

  it('shows FastAPI validation errors next to fields without exposing echoed input', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({
      detail: [
        { type: 'string_too_short', loc: ['body', 'full_name'], msg: 'String should have at least 2 characters', input: 'A', ctx: { min_length: 2 } },
        { type: 'value_error', loc: ['body', 'email'], msg: 'value is not a valid email address: An email address must have an @-sign.', input: 'invalid-email' },
        { type: 'string_too_short', loc: ['body', 'password'], msg: 'String should have at least 8 characters', input: 'short', ctx: { min_length: 8 } },
      ],
    }, 422)));
    renderRegistrationPage();

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText('Full name must contain at least 2 characters.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password must contain at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/invalid-email|short|\[object Object\]/i)).not.toBeInTheDocument();
  });

  it('shows a password mismatch beside the confirmation field', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({
      detail: [{
        type: 'value_error',
        loc: ['body', 'password_confirm'],
        msg: 'Value error, Passwords do not match.',
        input: 'DifferentPass123',
      }],
    }, 422)));
    renderRegistrationPage();

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('supports field-level validation errors in a field_errors object', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({
      field_errors: { email: 'Email is already registered.' },
    }, 400)));
    renderRegistrationPage();

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText('Email is already registered.')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a safe general alert when the network request fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderRegistrationPage();

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect to the server. Check your connection and try again.'
    );
    expect(screen.queryByText(/Failed to fetch/i)).not.toBeInTheDocument();
  });

  it('does not expose server internals from failed API responses', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({
      detail: 'Traceback: SQL database exception: private details',
    }, 500)));
    renderRegistrationPage();

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete your registration. Please try again.'
    );
    expect(screen.queryByText(/Traceback|SQL database|private details/i)).not.toBeInTheDocument();
  });

  it('does not expose passwords echoed in ordinary API error messages', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({
      detail: 'Registration rejected for StrongPass123.',
    }, 400)));
    renderRegistrationPage();

    await fillRegistrationForm(user);
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not complete your registration. Please try again.'
    );
    expect(screen.queryByText(/StrongPass123/i)).not.toBeInTheDocument();
  });
});
