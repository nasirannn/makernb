import Link from "next/link";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Commercial Use License - MakeRNB",
  description: "Commercial use license for AI-generated music created with MakeRNB. Review usage rights, permitted uses, and restrictions.",
  alternates: {
    canonical: 'https://makernb.com/license',
  },
  openGraph: {
    url: 'https://makernb.com/license',
    title: "Commercial Use License - MakeRNB",
    description: "Commercial use license for AI-generated music created with MakeRNB. Review usage rights, permitted uses, and restrictions.",
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
        <h1 className="text-4xl font-bold mb-4">Commercial Use License</h1>
        <p className="text-muted-foreground">
          Last updated: September 18, 2025
        </p>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none">
        <section className="mb-8">
          <p className="mb-4">
            This Commercial Use License (&quot;License&quot;) is granted by an individual developer (&quot;Licensor&quot;),
            who operates an AI-powered music generation service (the &quot;Service&quot;).
          </p>
          <p className="mb-4">
            This License applies solely to the commercial use of music generated through the Service
            (&quot;Generated Music&quot;) and is separate from the Terms of Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Licensor</h2>
          <p className="mb-4">
            This Commercial Use License (&quot;License&quot;) is granted by an individual developer (&quot;Licensor&quot;),
            who operates an AI-powered music generation service (the &quot;Service&quot;).
          </p>
          <p className="mb-4">
            This License applies solely to the commercial use of music generated through the Service
            (&quot;Generated Music&quot;) and is separate from the Terms of Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Scope of License</h2>
          <p className="mb-4">
            Subject to an active paid subscription, the Licensor grants you (&quot;User&quot;) a:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>non-exclusive</li>
            <li>non-transferable</li>
            <li>royalty-free</li>
            <li>limited commercial use license</li>
          </ul>
          <p className="mb-4">
            to use Generated Music in commercial projects,
            in accordance with the terms set forth in this License.
          </p>
          <p className="mb-4">
            This License grants usage rights only.
            Generated Music is licensed, not sold.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Permitted Commercial Uses</h2>
          <p className="mb-4">
            You may use Generated Music in commercial contexts, including but not limited to:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Online videos and social media content</li>
            <li>Podcasts and audio programs</li>
            <li>Games, applications, and websites</li>
            <li>Advertising, marketing, and promotional materials</li>
            <li>
              Client or commissioned projects where the Generated Music is embedded
              as part of a larger creative work
            </li>
          </ul>
          <p className="mb-4">
            No additional royalties or attribution are required.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Prohibited Uses</h2>
          <p className="mb-4">You may NOT:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Claim ownership or authorship of Generated Music itself</li>
            <li>Resell, sublicense, or redistribute Generated Music as standalone audio files</li>
            <li>Offer Generated Music as stock music or music templates</li>
            <li>
              Register Generated Music with any copyright registry,
              content identification system, or rights management service
            </li>
            <li>Use Generated Music as training data for other AI systems or models</li>
            <li>Use Generated Music in any unlawful, deceptive, or misleading manner</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Ownership and Rights</h2>
          <p className="mb-4">
            This License does not transfer ownership of any intellectual property.
          </p>
          <p className="mb-4">
            All rights not expressly granted under this License are reserved by the Licensor
            and/or the underlying technology providers.
          </p>
          <p className="mb-4">
            Nothing in this License shall be interpreted as a transfer of copyright ownership.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Third-Party Technology Disclosure</h2>
          <p className="mb-4">
            The Service relies on third-party technologies, including but not limited to
            AI models and APIs provided by external providers.
          </p>
          <p className="mb-4">
            The legal status, availability, and permitted use of Generated Music
            may be subject to the terms and limitations of such third-party providers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. No Warranty</h2>
          <p className="mb-4">
            Generated Music is provided &quot;as is&quot;.
          </p>
          <p className="mb-4">
            The Licensor makes no representations or warranties, express or implied,
            regarding originality, non-infringement, or suitability
            for any specific commercial purpose.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. User Responsibility</h2>
          <p className="mb-4">
            You acknowledge and agree that:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>You are solely responsible for how Generated Music is used in your projects</li>
            <li>You assume all legal risks associated with commercial use</li>
            <li>You will not represent Generated Music as legally guaranteed or risk-free</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Term and Termination</h2>
          <p className="mb-4">
            This License is effective only while your paid subscription remains active.
          </p>
          <p className="mb-4">
            The Licensor reserves the right to terminate this License
            in the event of a material breach of its terms.
          </p>
          <p className="mb-4">
            Upon termination, you must cease any new commercial use of Generated Music,
            except where continued use is permitted by applicable law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Governing Law</h2>
          <p className="mb-4">
            This License shall be governed by and construed in accordance with
            the laws of the Licensor&apos;s jurisdiction,
            without regard to conflict of law principles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Contact</h2>
          <p className="mb-4">
            For questions regarding this Commercial Use License, please contact:
          </p>
          <p className="mb-4">contact@makernb.com</p>
        </section>
      </div>
    </div>
  );
}
