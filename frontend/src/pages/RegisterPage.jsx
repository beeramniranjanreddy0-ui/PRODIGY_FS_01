import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', password_confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed.');
      }
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="auth-page">
        <div className="auth-visual">
          <div className="brand-row">
            <div className="brand-mark">AE</div>
            <div className="brand-copy">
              <span className="eyebrow">ARCTIC EMERALD</span>
              <strong>Secure onboarding</strong>
            </div>
          </div>

          <div className="hero-copy">
            <span className="kicker">New access profile</span>
            <h2>Build your secure environment in minutes.</h2>
            <p>
              Create your account and move directly into a controlled workspace with policy-enforced
              access and protected sessions.
            </p>
          </div>

          <ul className="feature-list">
            <li>Accelerated onboarding</li>
            <li>Robust identity controls</li>
            <li>Protected by design</li>
          </ul>

          <div className="status-card">
            <div className="status-header">
              <span className="status-dot" />
              <span>Access policy</span>
            </div>
            <div className="status-grid">
              <div>
                <small>Vault</small>
                <strong>Online</strong>
              </div>
              <div>
                <small>Auth</small>
                <strong>Active</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-card">
          <h1>Create account</h1>
          <p className="subtitle">Join your Prodygy workspace securely.</p>
          {error ? <div className="error-box">{error}</div> : null}
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" value={form.full_name} onChange={handleChange} required />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} required />
                <button type="button" onClick={() => setShowPassword((prev) => !prev)}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            <div>
              <label htmlFor="password_confirm">Confirm password</label>
              <input id="password_confirm" name="password_confirm" type={showPassword ? 'text' : 'password'} value={form.password_confirm} onChange={handleChange} required />
            </div>
            <button className="primary-btn" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
          <div className="auth-links">
            <span className="muted">Already have an account? </span>
            <Link to="/login">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
