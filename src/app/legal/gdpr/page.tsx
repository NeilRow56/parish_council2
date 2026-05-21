import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalArticle } from '@/components/public/public-page-shell'
import { branding } from '@/lib/branding'

export const metadata: Metadata = {
  title: 'GDPR & UK Data Protection'
}

export default function GDPRPage() {
  return (
    <LegalArticle>
      <h1>GDPR &amp; UK Data Protection</h1>

      <p>Last updated: 17 May 2026</p>

      <p>
        {branding.appName} is designed to support parish and town councils with
        bookkeeping, accounting records, AGAR preparation, financial reporting,
        bank reconciliation, and related year-end processes.
      </p>

      <p>
        This page explains how {branding.appName} aligns with UK data protection
        requirements under the UK GDPR and the Data Protection Act 2018.
      </p>

      <h2>1. Legal framework</h2>

      <p>
        Data protection in the United Kingdom is governed by the UK GDPR and the
        Data Protection Act 2018.
      </p>

      <p>
        {branding.appName} operates in line with core data protection
        principles, including:
      </p>

      <ul>
        <li>lawfulness, fairness, and transparency</li>
        <li>purpose limitation</li>
        <li>data minimisation</li>
        <li>accuracy</li>
        <li>storage limitation</li>
        <li>integrity and confidentiality</li>
        <li>accountability</li>
      </ul>

      <h2>2. Roles and responsibilities</h2>

      <p>
        In most cases, parish and town councils using {branding.appName} act as
        the <strong>data controllers</strong> for the information entered into
        the platform.
      </p>

      <p>
        {branding.appName} generally acts as a <strong>data processor</strong>,
        providing software and infrastructure used to manage accounting records,
        financial transactions, supporting documents, reconciliations, AGAR
        working papers, and related data.
      </p>

      <p>
        Councils remain responsible for ensuring that any personal data entered
        into {branding.appName} is processed lawfully and in accordance with
        applicable data protection obligations.
      </p>

      <h2>3. Bank data and Open Banking</h2>

      <p>
        {branding.appName} may allow councils to connect bank accounts using
        regulated Open Banking providers such as TrueLayer.
      </p>

      <p>
        Where enabled by the council, {branding.appName} may access account
        balances, transaction data, and related banking information for the
        purposes of:
      </p>

      <ul>
        <li>bank reconciliation</li>
        <li>transaction import and bookkeeping</li>
        <li>financial reporting</li>
        <li>cashbook processing</li>
        <li>AGAR preparation and year-end procedures</li>
      </ul>

      <p>
        Bank access permissions are controlled by the bank account holder and
        can normally be revoked through the relevant banking provider or within
        {branding.appName}.
      </p>

      <h2>4. Data processing</h2>

      <p>
        {branding.appName} processes personal data only as reasonably necessary
        to provide and support the service.
      </p>

      <p>This may include:</p>

      <ul>
        <li>user account details</li>
        <li>financial transaction data</li>
        <li>supplier and payee information</li>
        <li>uploaded supporting documentation</li>
        <li>audit trails and activity logs</li>
      </ul>

      <p>
        For further information about how personal data is processed, please see
        our <Link href='/legal/privacy'>Privacy Policy</Link>.
      </p>

      <h2>5. Beta and early access</h2>

      <p>
        {branding.appName} may from time to time be provided in beta, preview,
        or early access form while features are being refined and tested.
      </p>

      <p>
        Councils should assess whether the platform is suitable for their
        intended use before uploading sensitive or personal information.
      </p>

      <p>
        During testing or evaluation, councils may choose to use sample or
        non-live data where appropriate.
      </p>

      <h2>6. Security and access controls</h2>

      <p>
        {branding.appName} uses logical separation of organisation data together
        with authentication and access controls designed to restrict access to
        authorised users.
      </p>

      <p>
        The platform may use managed infrastructure and third-party service
        providers to support hosting, storage, authentication, file uploads, and
        Open Banking integrations.
      </p>

      <h2>7. Data subject rights</h2>

      <p>
        Requests relating to personal data held by a council should normally be
        directed to the relevant council acting as data controller.
      </p>

      <p>
        {branding.appName} will provide reasonable assistance to councils where
        required in relation to valid data protection requests.
      </p>

      <h2>8. International transfers</h2>

      <p>
        Some infrastructure or service providers used by {branding.appName} may
        process data outside the United Kingdom.
      </p>

      <p>
        Where this occurs, appropriate safeguards are applied where required to
        support compliance with UK data protection law.
      </p>

      <h2>9. ICO registration</h2>

      <p>
        {branding.appName} will maintain ICO registration where required by
        applicable UK data protection legislation.
      </p>

      <h2>10. Further information</h2>

      <p>
        For additional information, please see our{' '}
        <Link href='/legal/privacy'>Privacy Policy</Link> and{' '}
        <Link href='/legal/security'>Security &amp; Data Ownership</Link> pages.
      </p>

      <h2>11. Contact</h2>

      <p>For GDPR or data protection queries, contact:</p>

      <p>
        <a
          href={`mailto:${branding.supportEmail}`}
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary underline'
        >
          {branding.supportEmail}
        </a>
      </p>
    </LegalArticle>
  )
}
