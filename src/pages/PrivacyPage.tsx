import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/shared/LegalPageLayout';
import { LegalSection } from '../components/shared/LegalSection';
import { SUPPORT_EMAIL_LABEL, SUPPORT_MAILTO } from '../lib/support-config';

const TOC = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'account-data', label: 'Account & Authentication Data' },
  { id: 'workspace-data', label: 'Workspace & Source Data' },
  { id: 'chat-data', label: 'Conversations & Citations' },
  { id: 'career-data', label: 'Resume & Career Intelligence Data' },
  { id: 'usage-data', label: 'Usage Information' },
  { id: 'payment-data', label: 'Payment Records' },
  { id: 'third-party', label: 'Third-Party Providers' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'security', label: 'Security' },
  { id: 'retention', label: 'Retention & Deletion' },
  { id: 'responsibility', label: 'Your Responsibility for Uploaded Content' },
  { id: 'children', label: "Children's Privacy" },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact', label: 'Contact' },
];

export function PrivacyPage() {
  return (
    <LegalPageLayout
      eyebrow="Lumora policies"
      title="Privacy Policy"
      description="What Lumora processes, why, and which third-party providers are involved — scoped to what the product actually does."
      lastUpdated="August 18, 2026"
      toc={TOC}
    >
      <LegalSection id="introduction" title="1. Introduction">
        <p>
          This policy explains what information Lumora processes when you use the AI knowledge Workspace and Career
          Intelligence features, why it's processed, and when it's shared with a third-party provider. It reflects
          how the product is actually built, not a generic template.
        </p>
      </LegalSection>

      <LegalSection id="account-data" title="2. Account & Authentication Data">
        <p>
          Sign-in and account identity are handled by Clerk. We store your Clerk-issued user ID and the profile
          fields Clerk provides (such as name and email) to associate your Workspaces, usage, and payments with your
          account. We do not handle or store your password.
        </p>
      </LegalSection>

      <LegalSection id="workspace-data" title="3. Workspace & Source Data">
        <p>
          Content you add to a Workspace — PDFs, website text, YouTube transcripts, VTT files, or pasted text — is
          stored so it can be parsed, split into chunks, embedded, and indexed for retrieval. PDF file bytes are
          stored directly in our database. Embeddings are generated via OpenAI and stored alongside your chunks.
          Every Workspace and its contents are scoped to your account and isolated from other users.
        </p>
      </LegalSection>

      <LegalSection id="chat-data" title="4. Conversations & Citations">
        <p>
          Your chat messages and Lumora's responses are stored so your conversation history persists in a Workspace.
          Grounded responses store citation records (source, page/section/timestamp) linking the answer back to the
          retrieved evidence. Generating an answer may send your message and relevant retrieved context to OpenAI
          (and, for web-augmented answers, to Tavily).
        </p>
      </LegalSection>

      <LegalSection id="career-data" title="5. Resume & Career Intelligence Data" variant="ai">
        <p>
          If you use Career Intelligence, the resume file or text you provide is processed to extract a skill
          profile, matched against target roles, and used to generate a gap analysis and, if you build one, a
          learning path. This data is stored under your account the same way Workspace data is, and processing it
          may send resume content to OpenAI for extraction and analysis.
        </p>
      </LegalSection>

      <LegalSection id="usage-data" title="6. Usage Information">
        <p>
          We record metered usage events (for example, chat messages, ingestion runs, Skill Intelligence and Learning
          Path actions) against your account to enforce plan limits and show you your own usage summary.
        </p>
      </LegalSection>

      <LegalSection id="payment-data" title="7. Payment Records">
        <p>
          Payments are processed by Razorpay. We store the resulting payment record (order ID, payment ID, amount,
          status, method, and coupon if used) to grant access and show your payment history. We also retain the raw
          webhook notification Razorpay sends for each payment event, as an audit and idempotency record so the same
          event is never double-processed — this can include payment metadata Razorpay includes in that notification,
          such as a contact identifier. We do not receive or store your card, UPI, or bank account details — those
          are handled entirely by Razorpay.
        </p>
      </LegalSection>

      <LegalSection id="third-party" title="8. Third-Party Providers">
        <p>The following third-party providers may process data as part of using Lumora:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><span className="text-slate-300">Clerk</span> — authentication and session management.</li>
          <li><span className="text-slate-300">OpenAI</span> — chat responses, embeddings, and Career Intelligence extraction.</li>
          <li><span className="text-slate-300">Google (Gemini)</span> — YouTube transcript acquisition.</li>
          <li><span className="text-slate-300">Tavily</span> — optional web search augmentation, only when that path is used.</li>
          <li><span className="text-slate-300">Neon</span> — our managed Postgres database.</li>
          <li><span className="text-slate-300">Razorpay</span> — payment processing.</li>
          <li><span className="text-slate-300">Vercel and Render</span> — application hosting.</li>
        </ul>
        <p>Data only reaches a given provider when the feature that uses it is invoked.</p>
      </LegalSection>

      <LegalSection id="cookies" title="9. Cookies">
        <p>
          Lumora does not run analytics, advertising, or marketing trackers. The only cookies in use are the ones
          Clerk sets to keep you signed in and to protect your session — strictly necessary for the product to
          function, not for tracking. Because of that, we don't show a cookie-consent banner: there is no
          non-essential tracking to ask you to opt into.
        </p>
      </LegalSection>

      <LegalSection id="security" title="10. Security" variant="security">
        <p>
          Access to Workspace and source data is scoped and re-verified per request against your account. Payment
          webhooks are signature-verified before anything is trusted, and application logs exclude source content,
          secrets, and full webhook payloads.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="11. Retention & Deletion">
        <p>
          Deleting a Workspace or source removes it from the product. Payment records are kept as your payment
          history and to support entitlement checks. We do not currently offer a self-service full account deletion
          flow; contact us if you'd like your account and associated data removed.
        </p>
      </LegalSection>

      <LegalSection id="responsibility" title="12. Your Responsibility for Uploaded Content">
        <p>
          You are responsible for anything you upload. Don't add content you aren't authorized to share, or that
          contains other people's sensitive personal information without their permission.
        </p>
      </LegalSection>

      <LegalSection id="children" title="13. Children's Privacy">
        <p>Lumora is not directed at children and is not intended for use by anyone not permitted to form a binding contract.</p>
      </LegalSection>

      <LegalSection id="changes" title="14. Changes to This Policy">
        <p>
          We may update this policy as Lumora's features change. The "Last updated" date above reflects the most
          recent revision.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="15. Contact">
        <p>
          Privacy questions can be sent to{' '}
          <a href={SUPPORT_MAILTO} className="text-sky-300 underline decoration-sky-500/40 underline-offset-4 hover:text-sky-200">
            {SUPPORT_EMAIL_LABEL}
          </a>
          , or via the{' '}
          <Link to="/contact" className="text-sky-300 underline decoration-sky-500/40 underline-offset-4 hover:text-sky-200">
            Contact page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
