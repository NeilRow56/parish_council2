import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalArticle } from '@/components/public/public-page-shell'
import { branding } from '@/lib/branding'

export const metadata: Metadata = {
  title: 'Security & Data Ownership'
}

export default function SecurityPage() {
  return (
    <LegalArticle>
      <h1>Security &amp; Data Ownership</h1>

      <p>Last updated: 17 May 2026</p>

      <p>
        {branding.appName} is designed to help UK parish and town councils
        maintain bookkeeping records, bank reconciliation evidence, supporting
        documents, VAT records, and AGAR working papers in a controlled
        environment.
      </p>

      <h2>1. Council data ownership</h2>

      <p>
        Councils retain ownership of the accounting records, documents, and
        related information entered into {branding.appName}.
      </p>

      <p>
        In most cases, councils act as data controllers for their own records
        and {branding.appName} acts as a data processor providing software and
        supporting infrastructure.
      </p>

      <h2>2. Access controls</h2>

      <ul>
        <li>Access to the application requires authenticated user accounts</li>
        <li>Records are scoped to the relevant parish or town council</li>
        <li>
          Users should only be given access where they are authorised by the
          council
        </li>
        <li>Session and authentication controls are managed by the platform</li>
      </ul>

      <h2>3. Accounting record controls</h2>

      <ul>
        <li>Posted journals are intended to remain immutable</li>
        <li>Corrections should be made by reversal and reposting</li>
        <li>Closed financial years are intended to remain read-only</li>
        <li>Bank feed imports are reviewed before posting to the ledger</li>
      </ul>

      <h2>4. Infrastructure and storage</h2>

      <p>
        {branding.appName} uses managed infrastructure providers for hosting,
        database storage, authentication, file uploads, and Open Banking
        integrations. Data is transmitted over encrypted connections where
        supported by those providers.
      </p>

      <p>
        Uploaded supporting documents and external document references are
        linked to the relevant council records and should be treated as part of
        the council&apos;s accounting evidence.
      </p>

      <h2>5. Open Banking</h2>

      <p>
        Where a council enables bank feeds, {branding.appName} may use regulated
        Open Banking providers such as TrueLayer to access account and
        transaction data for bookkeeping, reconciliation, and reporting
        purposes.
      </p>

      <p>
        Bank permissions are controlled by the bank account holder and can
        normally be revoked through the bank, Open Banking provider, or within
        {branding.appName} where supported.
      </p>

      <h2>6. Council responsibilities</h2>

      <ul>
        <li>Keep user access limited to authorised personnel</li>
        <li>Use strong passwords and protect account credentials</li>
        <li>Review imported bank transactions before posting</li>
        <li>
          Check reports and year-end figures before submission or audit use
        </li>
        <li>
          Ensure any personal data entered into the system is processed lawfully
        </li>
      </ul>

      <h2>7. Further information</h2>

      <p>
        See the <Link href='/legal/privacy'>Privacy Policy</Link> and{' '}
        <Link href='/legal/gdpr'>GDPR &amp; UK Data Protection</Link> pages for
        more information about data protection.
      </p>

      <h2>8. Contact</h2>

      <p>
        For security or data ownership questions, contact{' '}
        <a
          href={`mailto:${branding.supportEmail}`}
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary underline'
        >
          {branding.supportEmail}
        </a>
        .
      </p>
    </LegalArticle>
  )
}
