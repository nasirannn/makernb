import { MetadataRoute } from 'next';
import { query } from '@/lib/db-pool';
import { getNonDefaultLocalePathSegments } from '@/lib/i18n/routing';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://makernb.com';

interface Track {
  id: string;
  updated_at: string;
}

/**
 * Generate dynamic sitemap for SEO
 *
 * This sitemap includes:
 * - Home page
 * - Explore page
 * - All public music tracks
 *
 * Learn more: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;
  const nonDefaultLocaleSegments = getNonDefaultLocalePathSegments();

  const staticPagesConfig: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }> = [
    { path: "", changeFrequency: 'daily', priority: 1 },
    { path: "/music-generator", changeFrequency: 'daily', priority: 0.9 },
    { path: "/sound-generator", changeFrequency: 'daily', priority: 0.85 },
    { path: "/vocal-separation", changeFrequency: 'daily', priority: 0.85 },
    { path: "/lyrics-generator", changeFrequency: 'daily', priority: 0.85 },
    { path: "/explore", changeFrequency: 'hourly', priority: 0.8 },
    { path: "/library", changeFrequency: 'daily', priority: 0.7 },
    { path: "/pricing", changeFrequency: 'weekly', priority: 0.75 },
    { path: "/blog", changeFrequency: 'daily', priority: 0.6 },
    { path: "/privacy", changeFrequency: 'monthly', priority: 0.3 },
    { path: "/terms", changeFrequency: 'monthly', priority: 0.3 },
    { path: "/sponsored-content-policy", changeFrequency: 'monthly', priority: 0.3 },
    { path: "/license", changeFrequency: 'monthly', priority: 0.3 },
    { path: "/refund", changeFrequency: 'monthly', priority: 0.2 },
  ];

  const staticPages: MetadataRoute.Sitemap = [
    ...staticPagesConfig.map((entry) => ({
      url: `${baseUrl}${entry.path}`,
      lastModified: new Date(),
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
    })),
    ...nonDefaultLocaleSegments.flatMap((segment) =>
      staticPagesConfig.map((entry) => ({
        url: `${baseUrl}/${segment}${entry.path}`,
        lastModified: new Date(),
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
      }))
    ),
  ];

  try {
    // Fetch public tracks for dynamic URLs
    const result = await query<Track>(`
      SELECT
        id,
        updated_at
      FROM tracks
      WHERE (is_deleted IS NULL OR is_deleted = false)
        AND is_published = true
      ORDER BY updated_at DESC
      LIMIT 1000
    `);

    const trackPages: MetadataRoute.Sitemap = result.rows.flatMap((track): MetadataRoute.Sitemap => {
      const defaultEntry: MetadataRoute.Sitemap[number] = {
        url: `${baseUrl}/track/${track.id}`,
        lastModified: new Date(track.updated_at),
        changeFrequency: 'weekly',
        priority: 0.6,
      };
      const localizedEntries: MetadataRoute.Sitemap = nonDefaultLocaleSegments.map((segment) => ({
        url: `${baseUrl}/${segment}/track/${track.id}`,
        lastModified: new Date(track.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
      return [defaultEntry, ...localizedEntries];
    });

    return [...staticPages, ...trackPages];
  } catch (error) {
    console.error('[Sitemap] Error generating sitemap:', error);
    // Return static pages only if database query fails
    return staticPages;
  }
}
