import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/shared/LegalPageLayout';
import { LegalSection } from '../components/shared/LegalSection';
import { SUPPORT_EMAIL_LABEL, SUPPORT_MAILTO } from '../lib/support-config';
import { PLAN_ACCESS_DAYS_DEFAULT } from '../lib/payments/config';

const TOC = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'acceptance', label: 'Acceptance of Terms' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'responsibilities', label: 'User Responsibilities' },
  { id: 'workspaces', label: 'Workspaces and Uploaded Content' },
  { id: 'acceptable-use', label: 'Acceptable Use' },
  { id: 'ai-output', label: 'AI-Generated Output' },
  { id: 'citations', label: 'Source-Grounded Responses and Citations' },
  { id: 'career-intelligence', label: 'Career Intelligence / Resume Analysis' },
  { id: 'third-party', label: 'Third-Party Services' },
  { id: 'payments', label: 'Payments' },
  { id: 'access-window', label: '30-Day Access' },
  { id: 'renewals', label: 'Renewals' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'refunds', label: 'Refunds & Cancellation' },
  { id: 'availability', label: 'Service Availability' },
  { id: 'ip', label: 'Intellectual Property' },
  { id: 'user-content', label: 'User Content' },
  { id: 'suspension', label: 'Suspension / Termination' },
  { id: 'disclaimer', label: 'Limitation of Liability' },
  { id: 'changes-service', label: 'Changes to the Service' },
  { id: 'changes-terms', label: 'Changes to These Terms' },
  { id: 'contact', label: 'Contact' },
];

export function TermsPage() {
  return (
    <LegalPageLayout
      eyebrow="Lumora policies"
      title="Terms of Use"
      description="These Terms govern your use of Lumora — an AI knowledge Workspace with grounded, cited chat and a Career Intelligence resume-to-learning-path flow."
      lastUpdated="August 18, 2026"
      toc={TOC}
    >
      <LegalSection id="introduction" title="1. Introduction">
        <p>
          Lumora ("Lumora", "we", "us") is an AI knowledge Workspace. You add sources — PDFs, websites, YouTube
          videos, VTT/transcript files, or plain text — to a Workspace, and chat about them; answers come either from
          general model knowledge or from your Workspace's own evidence with citations. Lumora also offers Career
          Intelligence: turning an uploaded resume into a role-fit and gap analysis, and an optional structured
          learning path.
        </p>
      </LegalSection>

      <LegalSection id="acceptance" title="2. Acceptance of Terms">
        <p>
          By creating an account or using Lumora in any way, you agree to these Terms. If you do not agree, do not
          use the service.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="3. Eligibility">
        <p>
          You must be able to form a binding contract under the laws that apply to you, and you must provide accurate
          account information when you sign up.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="4. Accounts">
        <p>
          Accounts are authenticated through Clerk. You are responsible for the activity that happens under your
          account and for keeping your sign-in credentials secure. Each Workspace and everything inside it is scoped
          to your account.
        </p>
      </LegalSection>

      <LegalSection id="responsibilities" title="5. User Responsibilities">
        <ul className="list-disc space-y-2 pl-5">
          <li>You are responsible for the accuracy and legality of anything you upload or paste into Lumora.</li>
          <li>You will not use Lumora to process content you are not authorized to possess or share.</li>
          <li>You are responsible for decisions you make based on Lumora's output, including Career Intelligence output.</li>
        </ul>
      </LegalSection>

      <LegalSection id="workspaces" title="6. Workspaces and Uploaded Content" variant="security">
        <p>
          A Workspace is a private container for your sources and chat history. Source content you upload (including
          PDF file bytes) is stored so it can be parsed, chunked, embedded, and retrieved for your questions. You may
          delete a Workspace or its sources at any time from within the product.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="7. Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Upload unlawful content, or content that infringes someone else's rights.</li>
          <li>Attempt to bypass usage limits, authentication, or Workspace isolation.</li>
          <li>Use Lumora to build a competing product by systematically extracting its underlying data or models.</li>
          <li>Interfere with the normal operation of the service, including its ingestion or chat pipelines.</li>
        </ul>
      </LegalSection>

      <LegalSection id="ai-output" title="8. AI-Generated Output" variant="ai">
        <p>
          Lumora's chat and Career Intelligence features use AI models to generate output. AI-generated content can be
          incomplete or wrong. Review anything you rely on, especially before making decisions based on it.
        </p>
      </LegalSection>

      <LegalSection id="citations" title="9. Source-Grounded Responses and Citations" variant="ai">
        <p>
          When Lumora answers from your Workspace evidence, it labels the answer as grounded and attaches citations
          back to the specific page, section, or timestamp the claim came from. Grounded answers are only produced
          when Lumora determines retrieved evidence actually covers your question — otherwise you get a general
          answer with no citations, rather than a confident-sounding guess.
        </p>
      </LegalSection>

      <LegalSection id="career-intelligence" title="10. Career Intelligence / Resume Analysis">
        <p>
          If you use Career Intelligence, you upload a resume or paste its text. Lumora extracts skills and
          supporting evidence from that content, compares it against a set of target roles, and produces an
          explainable gap analysis and, if you choose, a staged learning path with recommended resources. This
          analysis is generated by Lumora's AI and extraction pipeline and is provided for your own informational and
          planning use — it is not a guarantee of job readiness, employability, or interview or hiring outcomes.
        </p>
      </LegalSection>

      <LegalSection id="third-party" title="11. Third-Party Services">
        <p>Lumora relies on third-party providers to operate. Depending on which feature you use, this may include:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Clerk for authentication and session management.</li>
          <li>OpenAI for chat responses and embeddings.</li>
          <li>Google (Gemini) for YouTube transcript acquisition.</li>
          <li>Tavily for optional web search augmentation, where enabled.</li>
          <li>Neon (managed Postgres) for data storage.</li>
          <li>Razorpay for payment processing.</li>
          <li>Vercel and Render for hosting the application.</li>
        </ul>
        <p>Each provider's own terms and policies apply to the data they process on Lumora's behalf.</p>
      </LegalSection>

      <LegalSection id="payments" title="12. Payments" variant="security">
        <p>
          CORE and MAX are one-time purchases processed through Razorpay, in Indian Rupees. Lumora does not use
          Razorpay Subscriptions, UPI Autopay, or any recurring-mandate product — there is no auto-renewal and no
          card is stored for future charges. Every purchase or renewal creates a fresh order; a charge only completes
          when Razorpay confirms the payment.
        </p>
      </LegalSection>

      <LegalSection id="access-window" title="13. 30-Day Access">
        <p>
          A successful CORE or MAX purchase grants the plan's usage limits for {PLAN_ACCESS_DAYS_DEFAULT} days from
          the time of payment. When that window ends, your account returns to FREE limits (or to a lower plan you
          still have unexpired access to). Your Workspaces, sources, and chat history are not deleted when access
          expires — only the higher usage capacity ends.
        </p>
      </LegalSection>

      <LegalSection id="renewals" title="14. Renewals">
        <p>
          Renewing the same plan before it expires stacks: the new access window is added on top of your remaining
          time rather than replacing it, so you never lose access days you've already paid for. Renewal is always a
          manual action you take — nothing renews automatically.
        </p>
      </LegalSection>

      <LegalSection id="upgrades" title="15. Upgrades">
        <p>
          Upgrading from CORE to MAX is simply purchasing MAX. Your account is entitled to whichever unexpired plan
          gives you the higher limits; if remaining CORE access still exists once MAX access ends, it resumes
          automatically.
        </p>
      </LegalSection>

      <LegalSection id="refunds" title="16. Refunds & Cancellation">
        <p>
          Because CORE and MAX are one-time, non-recurring purchases, there is nothing to "cancel" — access simply
          runs for {PLAN_ACCESS_DAYS_DEFAULT} days and then ends unless you renew. If you believe a charge was made in
          error or you have a refund question, contact{' '}
          <a href={SUPPORT_MAILTO} className="text-sky-300 underline decoration-sky-500/40 underline-offset-4 hover:text-sky-200">
            {SUPPORT_EMAIL_LABEL}
          </a>{' '}
          and we will review it directly; refunds are handled case by case rather than under a fixed automatic
          policy.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="17. Service Availability">
        <p>
          Lumora is actively developed and deployed for live testing. Features, limits, and availability may change
          as the product evolves, and the service may occasionally be unavailable for maintenance or due to
          third-party provider outages.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="18. Intellectual Property">
        <p>
          Lumora's product, branding, and underlying software are owned by Lumora. These Terms do not grant you any
          rights to Lumora's intellectual property beyond what is needed to use the service as intended.
        </p>
      </LegalSection>

      <LegalSection id="user-content" title="19. User Content">
        <p>
          You retain ownership of the content you upload. You grant Lumora the limited right to store, process, and
          transmit that content — including to the third-party providers listed above — solely to provide the
          service back to you.
        </p>
      </LegalSection>

      <LegalSection id="suspension" title="20. Suspension / Termination">
        <p>
          We may suspend or terminate access for accounts that violate these Terms, including the Acceptable Use
          section above. You may stop using Lumora and delete your Workspaces at any time.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" title="21. Limitation of Liability">
        <p>
          Lumora is provided "as is." To the fullest extent permitted by law, Lumora is not liable for indirect,
          incidental, or consequential damages arising from your use of the service, including reliance on
          AI-generated chat responses or Career Intelligence output.
        </p>
      </LegalSection>

      <LegalSection id="changes-service" title="22. Changes to the Service">
        <p>
          We may add, change, or remove features as Lumora develops. We'll make reasonable efforts to avoid
          disrupting access you've already paid for.
        </p>
      </LegalSection>

      <LegalSection id="changes-terms" title="23. Changes to These Terms">
        <p>
          We may update these Terms as the product changes. The "Last updated" date at the top of this page reflects
          the most recent revision. Continued use after an update means you accept the revised Terms.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="24. Contact">
        <p>
          Questions about these Terms can be sent to{' '}
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
