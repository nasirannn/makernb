import Link from "next/link";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://makernb.com'),
  title: "Terms of Service - MakeRNB",
  description: "Terms of Service for MakeRNB - AI-powered R&B music creation platform.",
  alternates: {
    canonical: 'https://makernb.com/terms',
  },
  openGraph: {
    url: 'https://makernb.com/terms',
  },
};

export default function TermsOfService() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="mb-8">
        <Link 
          href="/" 
          className="text-primary hover:underline mb-4 inline-block"
        >
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground">
          Last updated: January 2025
        </p>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Agreement to Terms</h2>
          <p className="mb-4">
            By accessing and using MakeRNB (&quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you disagree with any part of these terms, you may not access the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Description of Service</h2>
          <p className="mb-4">
            MakeRNB is an AI-powered music generation platform that specializes in creating authentic R&B tracks. Our service allows users to generate original music in various R&B styles including classic soul, contemporary R&B, and other related genres.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">User Accounts</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>You must provide accurate and complete information when creating an account</li>
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>You must notify us immediately of any unauthorized use of your account</li>
            <li>One person or entity may not maintain multiple accounts</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Acceptable Use</h2>
          <p className="mb-4">You agree not to:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Use the Service for any illegal or unauthorized purpose</li>
            <li>Generate content that infringes on third-party copyrights or trademarks</li>
            <li>Create content that is offensive, harmful, or violates community standards</li>
            <li>Attempt to reverse engineer or copy our AI technology</li>
            <li>Use automated tools to abuse our service or exceed usage limits</li>
            <li>Share your account credentials with others</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Intellectual Property Rights</h2>
          
          <h3 className="text-xl font-medium mb-3">Your Generated Content</h3>
          <p className="mb-4">
            You retain ownership rights to the music you generate using our Service. You may use, modify, distribute, and commercialize your generated tracks without additional licensing fees from us.
          </p>

          <h3 className="text-xl font-medium mb-3">Our Technology</h3>
          <p className="mb-4">
            The MakeRNB platform, including our AI models, algorithms, and software, remains our exclusive property. You may not copy, modify, or create derivative works based on our technology.
          </p>

          <h3 className="text-xl font-medium mb-3">Input Content</h3>
          <p className="mb-4">
            You represent that any lyrics or content you input into our Service is either original or you have the necessary rights to use it. You grant us a license to process this content for the purpose of generating your music.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Credits and Usage Limits</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>Free users receive daily credits that reset every 24 hours</li>
            <li>Credits are non-transferable and cannot be exchanged for cash</li>
            <li>Unused credits do not roll over to the next day</li>
            <li>We reserve the right to modify credit allocation and usage limits</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Privacy and Data</h2>
          <p className="mb-4">
            Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information. By using our Service, you consent to our data practices as described in the Privacy Policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Disclaimers</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>The Service is provided &quot;as is&quot; without warranties of any kind</li>
            <li>We do not guarantee the availability, accuracy, or reliability of the Service</li>
            <li>Generated music may occasionally contain similarities to existing works due to the nature of AI training</li>
            <li>We are not responsible for any copyright issues arising from your use of generated content</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
          <p className="mb-4">
            To the maximum extent permitted by law, MakeRNB shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or other intangible losses.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Termination</h2>
          <p className="mb-4">
            We may terminate or suspend your account and access to the Service at our sole discretion, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Changes to Terms</h2>
          <p className="mb-4">
            We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the updated Terms on our website. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Governing Law</h2>
          <p className="mb-4">
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which MakeRNB operates, without regard to conflict of law principles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
          <p className="mb-4">
            If you have any questions about these Terms of Service, please contact us at:
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <p><strong>Email:</strong> <a href="mailto:contact@makernb.com" className="text-primary hover:underline">contact@makernb.com</a></p>
            <p><strong>Address:</strong> MakeRNB Legal Team</p>
          </div>
        </section>
      </div>
    </div>
  );
}
