import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { auth, setAuth } = useAuth();
  const [form, setForm] = useState({ full_name: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        if (!response.ok) throw new Error('Unable to load profile.');
        const data = await response.json();
        setForm({ full_name: data.full_name });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (auth.accessToken) fetchProfile();
  }, [auth.accessToken]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Profile update failed.');
      setSuccess('Profile updated successfully.');
      setAuth((prev) => ({ ...prev, user: { ...prev.user, full_name: data.full_name } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!auth.accessToken) {
    return <Link to="/login">Please sign in</Link>;
  }

  return (
    <div className="app-shell">
      <div className="auth-card profile-card">
        <div className="form-header">
          <div>
            <span className="topbar-label">PROFILE SETTINGS</span>
            <h1>Edit profile</h1>
          </div>
          <button className="ghost-btn" type="button" onClick={() => navigate('/dashboard')}>
            Back
          </button>
        </div>

        <p className="subtitle">Update only your visible profile details</p>
        {error ? <div className="error-box">{error}</div> : null}
        {success ? <div className="success-box">{success}</div> : null}
        {loading ? <p className="muted-copy">Loading profile...</p> : (
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" value={form.full_name} onChange={(e) => setForm({ full_name: e.target.value })} required />
            </div>
            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button className="secondary-btn" type="button" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
          </form>
        )}
      </div>
    </div>
  );
}
