import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';

describe('App auth flow', () => {
  it('renders login screen by default', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });

  it('routes to registration page', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Create account/i)).toBeInTheDocument();
  });
});
