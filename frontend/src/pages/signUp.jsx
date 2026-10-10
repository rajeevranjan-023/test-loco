import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthInfoPanel from '../components/AuthInfoPanel';
import { useAuth } from '../context/AuthContext.jsx';
import '../css/Auth.css';

const Signup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    identifier: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
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

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!formData.agreedToTerms) {
      setError('Please accept the Terms & Conditions to continue.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await register(formData.fullName, formData.identifier, formData.password);
      const redirectTo = location.state?.from || '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            <p className="auth-eyebrow">Create account</p>
            <h1 className="auth-heading">Join us today</h1>
            <p className="auth-subheading">
              Create your account in a few seconds and start exploring everything we offer.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Jane Doe"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
              </div>

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
                  minLength={6}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              <label className="auth-checkbox auth-terms">
                <input
                  type="checkbox"
                  name="agreedToTerms"
                  checked={formData.agreedToTerms}
                  onChange={handleChange}
                />
                <p>I agree to the <Link to="/terms" className="auth-link">Terms &amp; Conditions</Link> and Privacy Policy</p>
              </label>

              {error && (
                <p style={{ color: '#e0455f', fontSize: '13.5px', margin: 0 }}>{error}</p>
              )}

              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="auth-switch">
              Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
            </p>
          </div>
        </div>

        <AuthInfoPanel
          title="Join Us"
          subtitle="Create an account to unlock all features and start collaborating with your team in minutes."
          features={[
            'Free to get started, no credit card needed',
            'Real-time collaboration with your team',
            'Priority support whenever you need it',
          ]}
          tagline="Join thousands of teams already building with us."
        />
      </div>
    </div>
  );
};

export default Signup;
