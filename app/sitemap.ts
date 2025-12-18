import { MetadataRoute } from 'next';
import { query } from '@/lib/db-pool';

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

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/library`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
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

    const trackPages: MetadataRoute.Sitemap = result.rows.map((track) => ({
      url: `${baseUrl}/track/${track.id}`,
      lastModified: new Date(track.updated_at),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

    return [...staticPages, ...trackPages];
  } catch (error) {
    console.error('[Sitemap] Error generating sitemap:', error);
    // Return static pages only if database query fails
    return staticPages;
  }
}
