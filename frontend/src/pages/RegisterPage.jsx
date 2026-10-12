import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerUser, RegistrationRequestError } from '../services/auth';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const submitting = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', password_confirm: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;

    submitting.current = true;
    setLoading(true);
    setError('');
    setFieldErrors({});

    try {
      const data = await registerUser(form);
      const accessToken = data.access_token || data.tokens?.access_token;
      const refreshToken = data.refresh_token || data.tokens?.refresh_token;
      setAuth({
        user: data.user,
        accessToken,
        refreshToken,
        loading: false,
        error: '',
      });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof RegistrationRequestError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError('We could not complete your registration. Please try again.');
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="app-shell app-shell--register">
      <main className="auth-page auth-page--single">
        <section className="auth-card auth-card--centered auth-card--register">

          <h1>Create account</h1>
          <p className="subtitle">Join your Prodigy workspace securely.</p>
          {error ? <div className="error-box" role="alert" aria-live="assertive">{error}</div> : null}
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="full_name">Full name</label>
              <input
                id="full_name"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                aria-invalid={Boolean(fieldErrors.full_name)}
                aria-describedby={fieldErrors.full_name ? 'full_name-error' : undefined}
              />
              {fieldErrors.full_name ? <p className="field-error" id="full_name-error">{fieldErrors.full_name}</p> : null}
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              {fieldErrors.email ? <p className="field-error" id="email-error">{fieldErrors.email}</p> : null}
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  required
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                />
                <button type="button" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password ? <p className="field-error" id="password-error">{fieldErrors.password}</p> : null}
            </div>
            <div>
              <label htmlFor="password_confirm">Confirm password</label>
              <input
                id="password_confirm"
                name="password_confirm"
                type={showPassword ? 'text' : 'password'}
                value={form.password_confirm}
                onChange={handleChange}
                required
                aria-invalid={Boolean(fieldErrors.password_confirm)}
                aria-describedby={fieldErrors.password_confirm ? 'password_confirm-error' : undefined}
              />
              {fieldErrors.password_confirm ? <p className="field-error" id="password_confirm-error">{fieldErrors.password_confirm}</p> : null}
            </div>
            <button className="primary-btn" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
          <div className="auth-links">
            <span className="muted">Already have an account? </span>
            <Link to="/login">Log in</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
