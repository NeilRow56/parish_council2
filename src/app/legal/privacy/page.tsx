import type { Metadata } from 'next'

import { LegalArticle } from '@/components/public/public-page-shell'

export const metadata: Metadata = {
  title: 'Privacy Policy'
}

export default function PrivacyPolicyPage() {
  return (
    <LegalArticle>
      <h1>Privacy Policy</h1>

      <p>Last updated: 17 May 2026</p>

      <p>
        WpAccPac (“we”, “us”, “our”) provides bookkeeping, accounting,
        reconciliation, AGAR preparation, and financial reporting software for
        UK parish and town councils.
      </p>

      <p>
        This Privacy Policy explains what data we collect, how it is used, and
        your rights in relation to that data.
      </p>

      <h2>1. Data We Collect</h2>

      <p>
        We collect only the information reasonably required to provide and
        support the WpAccPac service.
      </p>

      <h3>Account &amp; Organisation Data</h3>

      <ul>
        <li>Name and email address</li>
        <li>Council or organisation name</li>
        <li>User roles and access permissions</li>
        <li>Authentication and login information</li>
      </ul>

      <h3>Financial &amp; Accounting Data</h3>

      <ul>
        <li>Financial years and accounting records</li>
        <li>Nominal ledger and journal data</li>
        <li>Budgets and reserves information</li>
        <li>Supplier, payee, and project information</li>
        <li>Bank reconciliation and cashbook records</li>
        <li>Borrowings and fixed asset records</li>
        <li>AGAR and year-end working papers</li>
        <li>Audit notes, queries, and supporting schedules</li>
      </ul>

      <h3>Banking &amp; Open Banking Data</h3>

      <p>
        Where enabled by the council, WpAccPac may connect to bank accounts
        using regulated Open Banking providers such as TrueLayer.
      </p>

      <p>This may include access to:</p>

      <ul>
        <li>bank account identifiers</li>
        <li>account balances</li>
        <li>transaction history</li>
        <li>transaction references and descriptions</li>
      </ul>

      <p>
        Bank data is used solely for bookkeeping, reconciliation, transaction
        import, financial reporting, and related accounting functions within
        WpAccPac.
      </p>

      <h3>Documents &amp; Supporting Evidence</h3>

      <ul>
        <li>
          Users may upload supporting documents such as PDFs, invoices, images,
          and working papers
        </li>
        <li>
          WpAccPac also supports external document reference links where users
          choose to store files within their own systems
        </li>
        <li>
          Uploaded files are stored using managed third-party infrastructure
          providers
        </li>
        <li>
          Documents and references are scoped to the relevant organisation and
          financial year
        </li>
      </ul>

      <p>
        We do not collect or store payment card information directly. Billing,
        where applicable, is handled by third-party providers.
      </p>

      <h2>2. How Your Data Is Used</h2>

      <p>Your data is used solely to:</p>

      <ul>
        <li>Provide and operate the WpAccPac platform</li>
        <li>Store and present accounting records and reports</li>
        <li>Support bank reconciliation and transaction imports</li>
        <li>Generate AGAR and year-end information</li>
        <li>Enable collaboration and review workflows</li>
        <li>Provide support where requested</li>
        <li>Maintain, secure, and improve the platform</li>
      </ul>

      <p>We do not:</p>

      <ul>
        <li>Sell or rent your data</li>
        <li>Use your data for advertising purposes</li>
        <li>Analyse council financial data for marketing purposes</li>
      </ul>

      <h2>3. Legal Basis for Processing</h2>

      <p>
        We process personal data under one or more of the following lawful
        bases:
      </p>

      <ul>
        <li>
          <strong>Contract</strong> — where processing is necessary to provide
          the WpAccPac service
        </li>

        <li>
          <strong>Legitimate interests</strong> — where processing is necessary
          to operate, secure, maintain, and improve the platform
        </li>

        <li>
          <strong>Legal obligations</strong> — where we are required to retain
          or disclose information under applicable law
        </li>
      </ul>

      <h2>4. Data Storage &amp; Security</h2>

      <ul>
        <li>Structured data is stored within secure managed databases</li>

        <li>
          Uploaded files are stored using managed infrastructure providers
        </li>

        <li>
          Access to data is restricted by organisation and authenticated user
          permissions
        </li>

        <li>
          Data is transmitted using encrypted HTTPS connections where supported
        </li>

        <li>
          Application-level logging and audit information may be retained for
          operational and security purposes
        </li>
      </ul>

      <p>
        Further information is available on our{' '}
        <a href='/legal/security'>Security &amp; Data Ownership</a> page.
      </p>

      <h2>5. Third-Party Providers</h2>

      <p>
        WpAccPac uses trusted third-party providers to operate and support the
        platform.
      </p>

      <p>
        Depending on the features in use, these providers may include services
        for:
      </p>

      <ul>
        <li>application hosting and infrastructure</li>
        <li>database services</li>
        <li>file storage and uploads</li>
        <li>authentication and login management</li>
        <li>Open Banking integrations</li>
        <li>email delivery</li>
        <li>billing and payment processing</li>
      </ul>

      <p>
        These providers process data on our behalf under appropriate security
        and contractual obligations.
      </p>

      <h2>6. Data Location &amp; International Transfers</h2>

      <p>
        Data may be processed using infrastructure providers located within or
        outside the United Kingdom.
      </p>

      <p>
        Where required, appropriate safeguards are applied to support compliance
        with UK data protection law.
      </p>

      <h2>7. Data Ownership</h2>

      <p>Councils retain ownership of all data entered into WpAccPac.</p>

      <p>
        In most cases, WpAccPac acts as a data processor, providing tools and
        infrastructure used to manage council financial records and supporting
        information.
      </p>

      <p>
        Councils using the platform are generally the data controllers for the
        information entered into the service.
      </p>

      <p>
        Councils remain responsible for ensuring that they have appropriate
        authority and lawful basis for any personal data stored within WpAccPac.
      </p>

      <h2>8. Data Retention</h2>

      <p>
        Data is retained for as long as your account remains active unless a
        longer retention period is required by law.
      </p>

      <p>Upon request or account closure:</p>

      <ul>
        <li>data may be exported where supported</li>

        <li>
          remaining data will be deleted within a reasonable period unless
          retention is legally required
        </li>
      </ul>

      <h2>9. Your Rights</h2>

      <p>Depending on applicable law, you may have rights to:</p>

      <ul>
        <li>access personal data</li>
        <li>request correction of inaccurate data</li>
        <li>request deletion of personal data</li>
        <li>request restriction of processing</li>
        <li>request export of data where supported</li>
      </ul>

      <p>
        Requests relating to council data should normally be directed to the
        relevant council acting as data controller.
      </p>

      <p>
        WpAccPac will provide reasonable assistance where required in relation
        to valid requests.
      </p>

      <h2>10. Cookies</h2>

      <p>
        WpAccPac currently uses only essential cookies required to operate the
        application.
      </p>

      <p>These may include cookies used for:</p>

      <ul>
        <li>authentication</li>
        <li>session management</li>
        <li>security and fraud prevention</li>
      </ul>

      <p>
        WpAccPac does not currently use advertising or behavioural tracking
        cookies.
      </p>

      <p>
        If non-essential analytics or tracking technologies are introduced in
        the future, this policy will be updated and consent mechanisms added
        where required.
      </p>

      <h2>11. Children&apos;s Data</h2>

      <p>
        WpAccPac is intended for use by councils, finance officers, clerks,
        accountants, and other authorised users. It is not intended for use by
        individuals under 18.
      </p>

      <h2>12. Contact</h2>

      <p>
        If you have questions about this Privacy Policy or require additional
        information, please contact:
      </p>

      <p>
        <strong>Email:</strong>{' '}
        <a
          href='mailto:admin@wpaccpac.org'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary underline'
        >
          admin@wpaccpac.org
        </a>
      </p>
    </LegalArticle>
  )
}
