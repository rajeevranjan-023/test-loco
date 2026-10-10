import React from 'react'
import PageHero from '../components/PageHero.jsx'
import LegalLayout from '../components/legal/LegalLayout.jsx'
import { useTitle } from '../hooks/title.js'
import '../css/StaticPages.css'

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    body: [
      'By accessing or using SERVOP ("the Platform"), you agree to be bound by these Terms & Conditions and our Privacy Policy. If you do not agree with any part of these terms, please do not use the Platform.',
      'You must be at least 18 years old, or the age of legal majority in your jurisdiction, to create an account and use SERVOP.',
    ],
  },
  {
    id: 'user-responsibilities',
    title: '2. User Responsibilities',
    body: {
      type: 'list',
      items: [
        'Provide accurate, current and complete information when creating your account or listings.',
        'Keep your login credentials confidential and notify us immediately of any unauthorized use of your account.',
        'Use the Platform only for lawful purposes and in a way that does not infringe the rights of, or restrict or inhibit the use of the Platform by, anyone else.',
        'Ensure any product, service or pricing information you post as a seller is accurate and not misleading.',
      ],
    },
  },
  {
    id: 'account-rules',
    title: '3. Account Rules',
    body: [
      'You are responsible for all activity that occurs under your account. One person or business entity may not maintain more than one account without our permission.',
      'We reserve the right to suspend or terminate accounts that provide false information, violate these Terms, or are used for fraudulent or abusive activity.',
    ],
  },
  {
    id: 'use-of-platform',
    title: '4. Use of the Platform',
    body: [
      'SERVOP provides a discovery platform connecting buyers with local shops and independent service providers. We are not a party to, and do not guarantee, any transaction, sale or service agreement made between users.',
      'Sellers and service providers are independently responsible for the accuracy of their listings, the quality and safety of their products/services, and compliance with applicable local laws (including any licensing or tax obligations).',
    ],
  },
  {
    id: 'content-ownership',
    title: '5. Content Ownership',
    body: [
      'You retain ownership of any content you submit to the Platform (listing descriptions, photos, reviews, etc.). By posting content, you grant SERVOP a non-exclusive, worldwide, royalty-free license to display, distribute and promote that content as part of operating the Platform.',
      'The SERVOP name, logo, design and underlying software are owned by us and may not be copied, reproduced or used without prior written permission.',
    ],
  },
  {
    id: 'restrictions',
    title: '6. Restrictions & Misuse',
    body: {
      type: 'list',
      items: [
        'No posting of false, misleading, illegal, or infringing content or listings.',
        'No scraping, reverse-engineering, or automated data collection from the Platform without written consent.',
        'No attempts to interfere with, disrupt, or gain unauthorized access to the Platform, other accounts, or our systems.',
        'No harassment, discrimination, or abusive behavior toward other users, sellers, or service providers.',
      ],
    },
  },
  {
    id: 'liability',
    title: '7. Limitation of Liability',
    body: [
      'SERVOP is provided on an "as is" and "as available" basis. To the fullest extent permitted by law, we disclaim all warranties, express or implied, regarding the Platform\'s operation or the accuracy of listings.',
      'We are not liable for any indirect, incidental, or consequential damages arising from your use of the Platform, or from any transaction, product, or service obtained through a listing made by another user.',
    ],
  },
  {
    id: 'termination',
    title: '8. Termination Policy',
    body: [
      'You may stop using the Platform and delete your account at any time by contacting Support. We may suspend or terminate your access, with or without notice, if you violate these Terms or if we reasonably believe your account poses a risk to SERVOP or other users.',
    ],
  },
  {
    id: 'governing-rules',
    title: '9. Governing Rules',
    body: [
      'These Terms are governed by and construed in accordance with the laws of India, without regard to conflict-of-law principles. Any disputes arising from these Terms or use of the Platform will be subject to the exclusive jurisdiction of the courts located in New Delhi, India.',
      'We may update these Terms from time to time; continued use of the Platform after changes take effect constitutes acceptance of the revised Terms.',
    ],
  },
]

function Terms() {
  useTitle('Terms & Conditions')

  return (
    <div className="static-page legal-page">
      <PageHero
        eyebrow="Legal"
        title="Terms & Conditions"
        subtitle="The rules that keep SERVOP fair, safe and useful for everyone — please read them carefully."
      />
      <section className="section">
        <LegalLayout lastUpdated="September 22, 2026" sections={sections} />
      </section>
    </div>
  )
}

export default Terms
