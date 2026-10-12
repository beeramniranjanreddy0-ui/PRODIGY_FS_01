import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Login failed.');
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
      <main className="auth-page auth-page--single">
        <section className="auth-card auth-card--centered">
          <h1>Welcome back</h1>
          <p className="subtitle">Secure sign in to your account</p>
          {error ? <div className="error-box">{error}</div> : null}
          <form className="form-grid" onSubmit={handleSubmit}>
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
            <button className="primary-btn" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
          <div className="auth-links">
            <span className="muted">Need an account? </span>
            <Link to="/register">Register</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
