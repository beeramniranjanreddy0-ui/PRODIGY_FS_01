import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { auth } = useAuth();
  const location = useLocation();

  if (!auth.user || !auth.accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
