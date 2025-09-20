import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="mb-8">
        <Link 
          href="/" 
          className="text-primary hover:underline mb-4 inline-block"
        >
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground">
          Last updated: January 2025
        </p>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
          <p className="mb-4">
            Welcome to R&B Generator (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered R&B music generation service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
          
          <h3 className="text-xl font-medium mb-3">Personal Information</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Email address (for account creation and communication)</li>
            <li>Username and profile information</li>
            <li>Payment information (processed securely through third-party providers)</li>
          </ul>

          <h3 className="text-xl font-medium mb-3">Usage Information</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Music generation requests and preferences</li>
            <li>Generated music tracks and associated metadata</li>
            <li>Usage patterns and feature interactions</li>
            <li>Device information and IP address</li>
          </ul>

          <h3 className="text-xl font-medium mb-3">Content You Create</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Custom lyrics you input</li>
            <li>Music style preferences and settings</li>
            <li>Generated music tracks</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>Provide and improve our R&B music generation service</li>
            <li>Process your music generation requests</li>
            <li>Manage your account and provide customer support</li>
            <li>Send important service updates and notifications</li>
            <li>Analyze usage patterns to enhance user experience</li>
            <li>Ensure platform security and prevent abuse</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Information Sharing</h2>
          <p className="mb-4">
            We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>With your explicit consent</li>
            <li>To comply with legal obligations or court orders</li>
            <li>To protect our rights, property, or safety, or that of our users</li>
            <li>With trusted service providers who assist in operating our service (under strict confidentiality agreements)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
          <p className="mb-4">
            We implement industry-standard security measures to protect your information, including:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Encryption of data in transit and at rest</li>
            <li>Regular security audits and updates</li>
            <li>Access controls and authentication measures</li>
            <li>Secure data storage with reputable cloud providers</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
          <p className="mb-4">You have the right to:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Access and review your personal information</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Export your generated music and data</li>
            <li>Opt out of non-essential communications</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Cookies and Tracking</h2>
          <p className="mb-4">
            We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized content. You can control cookie settings through your browser preferences.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Children&apos;s Privacy</h2>
          <p className="mb-4">
            Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Changes to This Policy</h2>
          <p className="mb-4">
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p className="mb-4">
            If you have any questions about this Privacy Policy or our data practices, please contact us at:
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <p><strong>Email:</strong> privacy@rbgenerator.com</p>
            <p><strong>Address:</strong> R&B Generator Privacy Team</p>
          </div>
        </section>
      </div>
    </div>
  );
}
