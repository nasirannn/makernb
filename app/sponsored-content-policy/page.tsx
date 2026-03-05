import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sponsored Content and Link Policy - MakeRNB",
  description:
    "MakeRNB policy for guest posts, sponsored content, and link insertion requests. Review eligibility, disclosure, link attributes, editorial standards, and enforcement terms.",
  alternates: {
    canonical: "https://makernb.com/sponsored-content-policy",
  },
  openGraph: {
    url: "https://makernb.com/sponsored-content-policy",
    title: "Sponsored Content and Link Policy - MakeRNB",
    description:
      "MakeRNB policy for guest posts, sponsored content, and link insertion requests. Review eligibility, disclosure, link attributes, editorial standards, and enforcement terms.",
  },
};

export default function SponsoredContentPolicy() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="mb-8">
        <Link href="/" className="text-primary hover:underline mb-4 inline-block">
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-bold mb-4">Sponsored Content and Link Policy</h1>
        <p className="text-muted-foreground">Last updated: March 5, 2026</p>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Purpose and Scope</h2>
          <p className="mb-4">
            This policy governs sponsored content, guest post submissions, partner mentions, and
            link insertion requests on MakeRNB. It applies to both new articles and edits to
            existing pages.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Eligibility Requirements</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>Submissions must be highly relevant to our audience and product domain</li>
            <li>Content must provide clear user value and not be created solely for SEO</li>
            <li>All submissions must be accurate, original, and free of plagiarism</li>
            <li>
              We may request business identity details, target URLs, anchor text, and prior
              publishing examples before review
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Disclosure and Link Attributes</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>Paid placements are labeled as Sponsored, Partner Content, or equivalent</li>
            <li>Paid outbound links are published with rel=&quot;sponsored nofollow&quot;</li>
            <li>We do not provide dofollow links for paid placements</li>
            <li>
              We may add, update, or remove link attributes as needed to comply with search
              engine policies and applicable law
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Editorial Control</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>We retain full editorial discretion for all sponsored placements</li>
            <li>We may edit titles, copy, headings, links, and formatting before publishing</li>
            <li>We may reject, postpone, unpublish, or remove content at any time</li>
            <li>We may decline repetitive, low-quality, or manipulative requests</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Prohibited Categories</h2>
          <p className="mb-4">We do not accept sponsored placements for:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Illegal products or services</li>
            <li>Adult content or explicit services</li>
            <li>Gambling, betting, casino, or get-rich-quick schemes</li>
            <li>Malware, phishing, deceptive offers, or other harmful content</li>
            <li>
              Any topic that conflicts with user safety standards, platform integrity, or our
              brand positioning
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Commercial and Operational Terms</h2>
          <ul className="list-disc pl-6 mb-4">
            <li>Pricing, placement scope, and publication timeline are confirmed case by case</li>
            <li>Any accepted collaboration may require prepayment</li>
            <li>
              Published content may be updated when pages are refreshed, merged, or restructured
            </li>
            <li>
              We do not guarantee ranking outcomes, traffic levels, indexing timelines, or domain
              authority impact
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Enforcement and Policy Updates</h2>
          <p className="mb-4">
            We may remove or modify any sponsored content if it creates legal, regulatory, trust,
            or quality risks. We may update this policy at any time, and changes take effect when
            posted on this page.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact</h2>
          <p className="mb-4">
            For collaboration inquiries related to this policy, contact:
            <a href="mailto:contact@makernb.com" className="text-primary hover:underline ml-1">
              contact@makernb.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
