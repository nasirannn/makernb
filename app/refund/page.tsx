import Link from "next/link";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Refund Policy - MakeRNB",
  description: "MakeRNB refund policy and satisfaction guarantee. Learn about our 7-day trial period, refund eligibility, processing time, and step-by-step refund request procedures for subscription plans.",
  alternates: {
    canonical: 'https://makernb.com/refund',
  },
  openGraph: {
    url: 'https://makernb.com/refund',
    title: "Refund Policy - MakeRNB",
    description: "MakeRNB refund policy and satisfaction guarantee. Learn about our 7-day trial period, refund eligibility, processing time, and step-by-step refund request procedures for subscription plans.",
  },
};

export default function RefundPolicy() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="mb-8">
        <Link 
          href="/" 
          className="text-primary hover:underline mb-4 inline-block"
        >
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-bold mb-4">Refund Policy</h1>
        <p className="text-muted-foreground">
          Last updated: January 2025
        </p>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none">
        <section className="mb-8">
          <p className="mb-4">
            At MakeRNB, we value your satisfaction with our AI music creation platform. This document outlines our service satisfaction guarantee and reimbursement procedures.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Service Trial Period</h2>
          <p className="mb-4">
            Users may evaluate our service compatibility within a <strong>7-day assessment period</strong> following subscription activation. During this period, you can test our AI music generation features and determine if our service meets your needs.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Cancellation vs. Refund</h2>
          <p className="mb-4">
            Cancellation and refunds are separate actions. Cancelling a subscription in the Customer Portal immediately ends your subscription and stops future billing, but it does not automatically issue a refund.
          </p>
          <p className="mb-4">
            Refunds are not initiated through the Customer Portal. If you want to request a refund, please contact our support team as described below.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Qualification Requirements</h2>
          <p className="mb-4">To be eligible for a refund during the trial period, the following conditions must be met:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Account usage must remain within initial evaluation limits (maximum <strong>5 music compositions</strong>)</li>
            <li>Submit evaluation feedback through our support channel at <a href="mailto:contact@makernb.com" className="text-primary hover:underline">contact@makernb.com</a></li>
            <li>Include your registered email address and detailed service feedback in your communication</li>
            <li>Refund requests must be submitted within the 7-day trial period</li>
          </ul>
          <p className="mb-4 text-sm text-muted-foreground">
            <strong>Note:</strong> Exceeding 5 music compositions during the trial period may affect your eligibility for a full refund. We recommend testing our service thoroughly but within reasonable limits during the evaluation period.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Resolution Timeline</h2>
          <p className="mb-4">Our refund process follows a structured timeline:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Our support team evaluates each refund request within <strong>3 working days</strong> of receipt</li>
            <li>Approved refunds are processed via the initial payment method used for the subscription</li>
            <li>Refunds typically appear in your account within 5-10 business days after approval, depending on your payment provider</li>
            <li>Trial-period content and generated tracks will be archived upon service discontinuation</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Additional Considerations</h2>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Partial Refunds:</strong> If you have used credits beyond the 5-composition limit, a partial refund may be offered based on remaining unused subscription value</li>
            <li><strong>Subscription Status:</strong> Upon refund approval, your subscription will be cancelled and access to premium features will be revoked</li>
            <li><strong>Credits Adjustment:</strong> If a refund is approved, any remaining subscription credits may be adjusted or revoked</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Non-Refundable Situations</h2>
          <p className="mb-4">Please note that refunds may not be available in the following circumstances:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Refund requests submitted after the 7-day trial period has expired</li>
            <li>Accounts that have violated our Terms of Service</li>
            <li>Accounts that have exceeded reasonable usage limits during the trial period (more than 5 compositions)</li>
            <li>Duplicate refund requests for the same subscription</li>
            <li>Issues related to user error or inability to use the service due to technical requirements on the user&apos;s end</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Cancellation Process</h2>
          <p className="mb-4">
            To cancel a subscription, open the <strong>Manage Subscription</strong> link in your account to access the Customer Portal, then click <strong>Manage Subscription</strong> and choose <strong>Cancel Subscription</strong>. This cancellation takes effect immediately and stops future billing.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Refund Request Process</h2>
          <p className="mb-4">
            If you wish to request a refund, please follow these steps:
          </p>
          <ol className="list-decimal pl-6 mb-4">
            <li>Send an email to <a href="mailto:contact@makernb.com" className="text-primary hover:underline">contact@makernb.com</a> with the subject line &quot;Refund Request&quot;</li>
            <li>Include your registered email address in the email</li>
            <li>Provide detailed feedback about your experience and reasons for requesting a refund</li>
            <li>Mention the date of your subscription activation</li>
            <li>Our support team will review your request and respond within 3 working days</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
          <p className="mb-4">
            If you have any questions about this Refund Policy or need assistance with a refund request, please contact us:
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <p><strong>Email:</strong> <a href="mailto:contact@makernb.com" className="text-primary hover:underline">contact@makernb.com</a></p>
            <p className="text-muted-foreground text-sm mt-2">For refund inquiries, please use the subject line &quot;Refund Request&quot; to ensure timely processing. We aim to respond to all inquiries within 48 hours during business days.</p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Policy Updates</h2>
          <p className="mb-4">
            We reserve the right to modify this Refund Policy at any time. Changes will be posted on this page with an updated &quot;Last updated&quot; date. We encourage you to review this policy periodically to stay informed about our refund procedures.
          </p>
        </section>
      </div>
    </div>
  );
}
