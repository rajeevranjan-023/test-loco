import React from 'react'
import PageHero from '../components/PageHero.jsx'
import LegalLayout from '../components/legal/LegalLayout.jsx'
import { useTitle } from '../hooks/title.js'
import '../css/StaticPages.css'

const sections = [
  {
    id: 'introduction',
    title: '1. Introduction',
    body: [
      'This Privacy Policy explains how SERVOP ("we", "us", "our") collects, uses, shares and protects your information when you use our website and services (the "Platform").',
      'By creating an account or using SERVOP, you agree to the collection and use of information as described in this policy. If you do not agree, please discontinue use of the Platform.',
    ],
  },
  {
    id: 'information-we-collect',
    title: '2. Information We Collect',
    body: {
      type: 'list',
      items: [
        'Personal information you provide directly: name, email address, phone number, password, business/shop details, and profile photo.',
        'Location information: approximate or precise location (with your permission) used to show nearby shops, products and services.',
        'Transaction-related information: listings you create, products/services you view or save, and messages exchanged through the Platform.',
        'Non-personal information: browser type, device type, operating system, pages visited, and general usage patterns, collected automatically.',
      ],
    },
  },
  {
    id: 'how-we-use-information',
    title: '3. How We Use Your Information',
    body: {
      type: 'list',
      items: [
        'To create and manage your account, and to authenticate your logins securely.',
        'To show you relevant nearby shops, products, services and search results.',
        'To let sellers and service providers manage their listings, sales and analytics dashboards.',
        'To communicate with you — account updates, support responses, and (where you have opted in) product updates.',
        'To maintain the security, integrity and performance of the Platform, and to prevent fraud or misuse.',
        'To improve our features based on aggregated, anonymized usage trends.',
      ],
    },
  },
  {
    id: 'sharing-information',
    title: '4. When and With Whom We Share Information',
    body: [
      'We do not sell your personal information. We may share information in the following limited circumstances:',
      {
        type: 'list',
        items: [
          'With other users: your public profile, shop or listing details are visible to other users as part of the core function of the Platform.',
          'With service providers: trusted third parties who help us operate the Platform (hosting, analytics, email delivery, payment processing), bound by confidentiality obligations.',
          'For legal reasons: if required by law, regulation, legal process, or to protect the rights, property or safety of SERVOP, our users, or the public.',
          'Business transfers: in connection with a merger, acquisition, or sale of assets, subject to this policy or a comparable one.',
        ],
      },
    ],
  },
  {
    id: 'data-security',
    title: '5. Data Security',
    body: [
      'We use industry-standard measures to protect your data, including password hashing (bcrypt), encrypted connections (HTTPS), and access controls limiting who can view sensitive information within our team.',
      'No method of transmission or storage is 100% secure. While we work hard to protect your information, we cannot guarantee absolute security, and we encourage you to use a strong, unique password.',
    ],
  },
  {
    id: 'your-rights',
    title: '6. User Rights and Choices',
    body: {
      type: 'list',
      items: [
        'Access & correction: you can view and update most of your personal information from your account settings at any time.',
        'Deletion: you may request deletion of your account and associated personal data by contacting Support.',
        'Location permissions: you can allow or deny location access at any time through your browser or device settings.',
        'Marketing communications: you can opt out of non-essential emails via the unsubscribe link included in every message.',
      ],
    },
  },
  {
    id: 'cookies',
    title: '7. Cookies and Tracking Technologies',
    body: [
      'We use cookies and similar technologies (such as local storage) to keep you logged in, remember your theme preference (light/dark mode), and understand how the Platform is used.',
      'You can control or disable cookies through your browser settings; note that some features of the Platform may not function properly if cookies are disabled.',
    ],
  },
  {
    id: 'third-party-services',
    title: '8. Third-Party Services',
    body: [
      'The Platform may link to or integrate with third-party services (e.g. maps, payment gateways, analytics providers). These third parties have their own privacy policies, and we encourage you to review them — we are not responsible for the privacy practices of external sites.',
    ],
  },
  {
    id: 'data-retention',
    title: '9. Data Retention',
    body: [
      'We retain your personal information for as long as your account is active or as needed to provide you the Platform\'s services. If you delete your account, we will remove or anonymize your personal data within a reasonable period, except where retention is required for legal, security or fraud-prevention purposes.',
    ],
  },
  {
    id: 'policy-updates',
    title: '10. Updates to This Policy',
    body: [
      'We may update this Privacy Policy from time to time to reflect changes in our practices or for legal reasons. We will post the revised policy on this page with an updated "Last updated" date, and for material changes, we may notify you via email or an in-app notice.',
    ],
  },
  {
    id: 'contact',
    title: '11. Contact Us',
    body: [
      'If you have questions or concerns about this Privacy Policy or how your data is handled, please contact us at privacy@servop.com or through our Contact & Support page.',
    ],
  },
]

function Privacy() {
  useTitle('Privacy Policy')

  return (
    <div className="static-page legal-page">
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="Your privacy matters to us. Here's exactly what we collect, how we use it, and the choices you have."
      />
      <section className="section">
        <LegalLayout lastUpdated="September 22, 2026" sections={sections} />
      </section>
    </div>
  )
}

export default Privacy
