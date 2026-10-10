import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { auth, setAuth } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.accessToken) return;

    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        });
        if (!response.ok) {
          throw new Error('Unable to fetch profile.');
        }
        const data = await response.json();
        setProfile(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [auth.accessToken]);

  if (!auth.user || !auth.accessToken) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: auth.refreshToken }),
      });
    } finally {
      setAuth({ user: null, accessToken: null, refreshToken: null, loading: false, error: '' });
      navigate('/login');
    }
  };

  return (
    <div className="app-shell dashboard-shell">
      <div className="dashboard-grid">
        <div className="panel panel-hero">
          <div className="topbar">
            <div>
              <span className="topbar-label">ARCTIC EMERALD</span>
              <h1>Dashboard</h1>
            </div>
            <button className="ghost-btn" onClick={handleLogout} type="button">
              Log out
            </button>
          </div>

          <p className="subtitle">Your secure user workspace</p>
          {error ? <div className="error-box">{error}</div> : null}
          {loading ? <p className="muted-copy">Loading your profile...</p> : null}

          {profile ? (
            <>
              <div className="stats">
                <div className="stat-box accent-box">
                  <span className="meta-label">Full name</span>
                  <div className="stat-value">{profile.full_name}</div>
                </div>
                <div className="stat-box">
                  <span className="meta-label">Email</span>
                  <div className="stat-value">{profile.email}</div>
                </div>
              </div>

              <div className="panel-footer">
                <div className="mini-tile">
                  <span className="mini-title">Access status</span>
                  <strong>Protected</strong>
                </div>
                <div className="mini-tile">
                  <span className="mini-title">Session</span>
                  <strong>Verified</strong>
                </div>
              </div>

              <div className="inline-actions">
                <button className="secondary-btn" onClick={() => navigate('/profile')} type="button">
                  Edit profile
                </button>
                <button className="primary-btn" onClick={handleLogout} type="button">
                  Log out
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
