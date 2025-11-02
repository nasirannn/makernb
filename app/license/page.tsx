import Link from "next/link";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Commercial License Agreement - MakeRNB",
  description: "Commercial license agreement for MakeRNB users. Understand your rights to use generated music commercially.",
  alternates: {
    canonical: 'https://makernb.com/license',
  },
  openGraph: {
    url: 'https://makernb.com/license',
  },
};

export default function CommercialLicense() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="mb-8">
        <Link 
          href="/" 
          className="text-primary hover:underline mb-4 inline-block"
        >
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-bold mb-4">Commercial License Agreement</h1>
        <p className="text-muted-foreground">
          Last updated: January 2025
        </p>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none">
        <section className="mb-8">
          <p className="mb-4">
            This Commercial License Agreement (&quot;Agreement&quot;) outlines the commercial usage rights granted to users of MakeRNB. By using our service and generating music content, you agree to the terms outlined below.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. License Grant</h2>
          <p className="mb-4">
            I, as the developer and operator of MakeRNB, hereby grant you, the user, a non-exclusive, worldwide, royalty-free license to use, modify, distribute, and commercialize the music content you generate using the MakeRNB service, subject to the terms and conditions set forth in this Agreement.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Subscription-Based Rights</h2>
          
          <h3 className="text-xl font-medium mb-3">2.1 Paid Subscribers (Basic & Premium Tiers)</h3>
          <p className="mb-4">If you are a paid subscriber to MakeRNB, you are granted full commercial rights for all music generated during your active subscription period, including but not limited to:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>Copy:</strong> You may copy and duplicate the generated music content within your projects</li>
            <li><strong>Distribute:</strong> You may share and distribute your generated music on any platform, including but not limited to YouTube, TikTok, Instagram, Twitch, Facebook, Spotify, Apple Music, Amazon Music, SoundCloud, and other streaming or social media platforms</li>
            <li><strong>Adapt:</strong> You may modify, remix, or enhance the generated music to suit your creative needs</li>
            <li><strong>Commercialize:</strong> You may monetize your generated music on any platform without additional licensing fees or royalties to MakeRNB</li>
          </ul>

          <h3 className="text-xl font-medium mb-3">2.2 Rights Continuity</h3>
          <p className="mb-4">
            All rights granted to you for music generated during your subscription period remain in effect indefinitely, even after your subscription ends. You may continue to use, distribute, and commercialize music created during your active subscription period without restriction.
          </p>

          <h3 className="text-xl font-medium mb-3">2.3 Free Users</h3>
          <p className="mb-4">
            Free tier users may use generated music for non-commercial purposes only. Music generated during free tier usage may be shared on non-commercial platforms with attribution to MakeRNB. For commercial use, a paid subscription is required.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Ownership and Intellectual Property</h2>
          
          <h3 className="text-xl font-medium mb-3">3.1 Generated Content Ownership</h3>
          <p className="mb-4">
            You retain full ownership of all music content you generate using MakeRNB. This includes all musical compositions, melodies, arrangements, and any modifications you make to the generated content.
          </p>

          <h3 className="text-xl font-medium mb-3">3.2 Platform Technology</h3>
          <p className="mb-4">
            The MakeRNB platform, including AI models, algorithms, software, and underlying technology, remains the exclusive property of the developer. This Agreement does not grant you any rights to the platform technology itself.
          </p>

          <h3 className="text-xl font-medium mb-3">3.3 Third-Party Content</h3>
          <p className="mb-4">
            If you input lyrics or other content into the service, you represent that you have the necessary rights to use such content. You are responsible for ensuring compliance with any third-party rights associated with your input content.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Permitted Uses</h2>
          <p className="mb-4">Subject to your subscription tier, you may use generated music for:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Commercial music releases and distribution</li>
            <li>Background music for videos, podcasts, and other media content</li>
            <li>Advertising and marketing campaigns</li>
            <li>Live performances and concerts</li>
            <li>Synchronization with visual media (film, television, games)</li>
            <li>Royalty-free licensing to third parties</li>
            <li>Any other commercial or non-commercial use as applicable under your subscription tier</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Restrictions</h2>
          <p className="mb-4">You agree not to:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Claim ownership of the MakeRNB platform technology or AI models</li>
            <li>Reverse engineer or attempt to replicate the platform&apos;s functionality</li>
            <li>Use generated content in ways that violate applicable laws or infringe on third-party rights</li>
            <li>Redistribute or resell access to the MakeRNB service itself</li>
            <li>Use the service to generate content that is illegal, harmful, or violates community standards</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Attribution</h2>
          <p className="mb-4">
            While attribution is not required for paid subscribers, we appreciate credit when appropriate. Free tier users are required to attribute generated content to MakeRNB when sharing on public platforms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. No Warranty</h2>
          <p className="mb-4">
            Generated music is provided &quot;as is&quot; without warranties of any kind. While we strive to ensure quality, we do not guarantee that generated content will be free from similarities to existing works, or that it will meet your specific requirements. You assume full responsibility for your use of generated content.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
          <p className="mb-4">
            To the maximum extent permitted by law, I, as the developer of MakeRNB, shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of generated content, including but not limited to copyright claims, licensing disputes, or commercial losses.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
          <p className="mb-4">
            You agree to indemnify and hold harmless the developer of MakeRNB from any claims, damages, losses, or expenses (including legal fees) arising from your use of generated content or violation of this Agreement.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
          <p className="mb-4">
            This Agreement remains in effect for all content generated during your subscription period, regardless of whether your subscription is later cancelled or terminated. If you violate the terms of this Agreement, I reserve the right to terminate your access to the service, but your rights to previously generated content remain unaffected.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Changes to Agreement</h2>
          <p className="mb-4">
            I reserve the right to modify this Commercial License Agreement at any time. Material changes will be posted on this page with an updated &quot;Last updated&quot; date. Your continued use of the service after such changes constitutes acceptance of the modified Agreement. Changes to the Agreement do not affect rights already granted for previously generated content.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
          <p className="mb-4">
            This Agreement shall be governed by and construed in accordance with the laws applicable to the jurisdiction where the MakeRNB service is operated, without regard to conflict of law principles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
          <p className="mb-4">
            If you have any questions about this Commercial License Agreement, please contact me:
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <p><strong>Email:</strong> <a href="mailto:contact@makernb.com" className="text-primary hover:underline">contact@makernb.com</a></p>
            <p className="text-muted-foreground text-sm mt-2">
              For legal inquiries regarding licensing, please reach out via email and I will respond within 48 hours.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">14. Entire Agreement</h2>
          <p className="mb-4">
            This Commercial License Agreement, together with the Terms of Service and Privacy Policy, constitutes the entire agreement between you and the developer of MakeRNB regarding the commercial use of generated content. If any provision of this Agreement is found to be unenforceable, the remaining provisions shall continue in full force and effect.
          </p>
        </section>
      </div>
    </div>
  );
}

