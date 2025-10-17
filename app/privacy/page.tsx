import Link from "next/link";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Privacy Policy - MakeRNB",
  description: "MakeRNB lets you instantly create and download professional R&B songs with AI. Explore Neo-Soul, Quiet Storm & more — free, online, and easy to use.",
  alternates: {
    canonical: 'https://makernb.com/privacy',
  },
  openGraph: {
    url: 'https://makernb.com/privacy',
  },
};

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
            Welcome to MakeRNB (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered R&B music generation service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
          
          <h3 className="text-xl font-medium mb-3">Personal Information</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Email address (collected via Google OAuth authentication)</li>
            <li>Profile information from Google (name, profile picture) when you sign in with Google</li>
            <li>Username and display preferences</li>
            <li>Authentication tokens and session data</li>
          </ul>

          <h3 className="text-xl font-medium mb-3">Usage Information</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Music generation requests and preferences</li>
            <li>Generated music tracks and associated metadata</li>
            <li>Credit balance, transaction history, and daily login records</li>
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
            <li>Display your generated music in our public explore section (with your consent)</li>
            <li>Showcase community-created content to promote platform engagement</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">User-Generated Content and Public Display</h2>
          <p className="mb-4">
            When you create music using our service, you have the option to make your creations public and share them with our community. Here&apos;s how we handle your user-generated content:
          </p>
          
          <h3 className="text-xl font-medium mb-3">Public Display of Your Content</h3>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Music Tracks:</strong> If you choose to make your generated music public, it may be displayed in our explore section for other users to discover and enjoy</li>
            <li><strong>Author Information:</strong> When you opt to show authorship, your display name and profile picture may be displayed alongside your music</li>
            <li><strong>Music Metadata:</strong> Information such as genre, style, and creation date may be shown to help other users discover your content</li>
          </ul>

          <h3 className="text-xl font-medium mb-3">Your Control and Consent</h3>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Opt-in Only:</strong> Your content will only be displayed publicly if you explicitly choose to make it public</li>
            <li><strong>Revocable Consent:</strong> You can change your privacy settings at any time to make your content private or public</li>
            <li><strong>Author Attribution:</strong> You can choose whether to display your name and profile picture with your music</li>
            <li><strong>Content Removal:</strong> You can request removal of your content from public display at any time</li>
          </ul>

          <h3 className="text-xl font-medium mb-3">Community Benefits</h3>
          <p className="mb-4">
            Public display of user-generated content helps build our community by:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Showcasing the creative potential of our AI music generation</li>
            <li>Allowing users to discover and enjoy music created by others</li>
            <li>Building a vibrant community of music creators and enthusiasts</li>
            <li>Providing inspiration and examples for new users</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
          <p className="mb-4">
            We use trusted third-party services to provide and improve our platform. These services have access to certain information only to perform specific tasks on our behalf:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Google OAuth:</strong> For secure authentication and login services</li>
            <li><strong>Supabase:</strong> For database management, authentication, and data storage</li>
            <li><strong>Cloudflare R2:</strong> For secure storage and delivery of generated audio files</li>
            <li><strong>AI Service Providers:</strong> For music generation and processing (input data is processed securely and not stored by third parties)</li>
            <li><strong>Analytics Services:</strong> For understanding usage patterns and improving user experience</li>
          </ul>
          <p className="mb-4">
            All third-party providers are required to maintain the confidentiality and security of your information and are prohibited from using it for any purpose other than providing services to us.
          </p>
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
            <li>With trusted service providers listed above (under strict confidentiality agreements)</li>
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
            <li>Control the public visibility of your generated music</li>
            <li>Choose whether to display your name and profile with your content</li>
            <li>Request removal of your content from public display at any time</li>
            <li>Change your privacy preferences for future content</li>
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
            If you have any questions about this Privacy Policy or our data practices, please contact us:
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <p><strong>Email:</strong> <a href="mailto:contact@makernb.com" className="text-primary hover:underline">contact@makernb.com</a></p>
            <p className="text-muted-foreground text-sm mt-2">We typically respond to privacy inquiries within 48 hours.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
