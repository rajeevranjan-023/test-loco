import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthInfoPanel from '../components/AuthInfoPanel';
import { useAuth } from '../context/AuthContext.jsx';
import '../css/Auth.css';
import { useTitle } from "../hooks/title";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(formData.identifier, formData.password);
      const redirectTo = location.state?.from || '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    useTitle("Login"),
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            <p className="auth-eyebrow">Sign in</p>
            <h1 className="auth-heading">Welcome back</h1>
            <p className="auth-subheading">
              Enter your details to access your account and pick up right where you left off.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="identifier">Email</label>
                <input
                  id="identifier"
                  name="identifier"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.identifier}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="auth-row">
                <label className="auth-checkbox">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                  />
                  Remember me
                </label>
                <Link to="/forgot-password" className="auth-link">
                  Forgot password?
                </Link>
              </div>

              {error && (
                <p style={{ color: '#e0455f', fontSize: '13.5px', margin: 0 }}>{error}</p>
              )}

              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="auth-switch">
              Don&apos;t have an account? <Link to="/signup" className="auth-link">Sign up</Link>
            </p>
          </div>
        </div>

        <AuthInfoPanel
          title="Welcome Back"
          subtitle="Sign in to continue managing your projects, tracking progress, and collaborating with your team."
          features={[
            'Secure, encrypted access to your account',
            'Sync your data across every device',
            'Pick up instantly where you left off',
          ]}
          tagline="Trusted by teams to keep their work moving, every day."
        />
      </div>
    </div>
  );
};

export default Login;
