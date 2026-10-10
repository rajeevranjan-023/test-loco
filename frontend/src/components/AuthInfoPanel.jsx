import React from 'react';
const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M13.5 4L6 11.5L2.5 8"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AuthInfoPanel = ({ title, subtitle, features, tagline }) => {
  return (
    <div className="auth-info-panel">
      <div className="auth-info-content">
        <h2 className="auth-info-title">{title}</h2>
        <p className="auth-info-subtitle">{subtitle}</p>

        <ul className="auth-feature-list">
          {features.map((feature, index) => (
            <li key={index}>
              <span className="auth-check-icon">
                <CheckIcon />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <p className="auth-tagline">{tagline}</p>
      </div>
    </div>
  );
};

export default AuthInfoPanel;
