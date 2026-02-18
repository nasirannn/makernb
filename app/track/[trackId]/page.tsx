import type { Metadata } from "next";
import { TrackDetailView } from "@/components/ui/track-detail-view";
import { query } from "@/lib/db-query-builder";

interface TrackDetailPageProps {
  params: Promise<{
    trackId: string;
  }>;
}

export async function generateMetadata({ params }: TrackDetailPageProps): Promise<Metadata> {
  const { trackId } = await params;
  const canonical = `https://makernb.com/track/${trackId}`;

  const formatDuration = (duration: number | string | null | undefined) => {
    const seconds = typeof duration === "string" ? Number.parseFloat(duration) : duration ?? 0;
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return null;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const parseTags = (value: string | null | undefined) => {
    if (!value) return [];
    return value
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 10);
  };

  const baseFallback: Metadata = {
    title: "Track | MakeRNB",
    description: "Listen to an AI-generated R&B track on MakeRNB.",
    alternates: { canonical },
    robots: { index: false, follow: false },
  };

  try {
    const result = await query<{
      title: string | null;
      tags: string | null;
      duration: number | null;
      cover_image_url: string | null;
      is_published: boolean | null;
    }>(
      `SELECT
        COALESCE(mt.title, mg.title) as title,
        mg.tags,
        mt.duration,
        mt.cover_image_url,
        mt.is_published
      FROM tracks mt
      INNER JOIN music mg ON mt.music_id = mg.id
      WHERE mt.id = $1::uuid
        AND (mt.is_deleted IS NULL OR mt.is_deleted = FALSE)
      LIMIT 1`,
      [trackId]
    );

    if (result.rows.length === 0) {
      return {
        ...baseFallback,
        title: "Track not found | MakeRNB",
        description: "This track is unavailable or has been removed.",
      };
    }

    const row = result.rows[0];
    const trackTitle = (row.title || "Track").trim();
    const tags = parseTags(row.tags);
    const durationText = formatDuration(row.duration);

    const descriptionParts: string[] = [
      `Listen to “${trackTitle}” — an AI-generated R&B track on MakeRNB.`,
    ];
    if (durationText) {
      descriptionParts.push(`Duration: ${durationText}.`);
    }
    if (tags.length > 0) {
      descriptionParts.push(`Tags: ${tags.slice(0, 6).join(", ")}.`);
    }

    const description = descriptionParts.join(" ");
    const canIndex = Boolean(row.is_published);
    const images = row.cover_image_url ? [{ url: row.cover_image_url }] : undefined;

    return {
      title: `${trackTitle} | MakeRNB`,
      description,
      alternates: { canonical },
      keywords: tags.length > 0 ? tags : undefined,
      robots: canIndex ? { index: true, follow: true } : { index: false, follow: false },
      openGraph: {
        title: trackTitle,
        description,
        url: canonical,
        siteName: "MakeRNB",
        type: "music.song",
        images,
      },
      twitter: {
        card: images?.length ? "summary_large_image" : "summary",
        title: trackTitle,
        description,
        images: images?.map((image) => image.url),
      },
    };
  } catch (error) {
    console.error("[track-metadata] Failed to build metadata:", error);
    return baseFallback;
  }
}

export default async function TrackDetailPage({ params }: TrackDetailPageProps) {
  const { trackId } = await params;
  return <TrackDetailView trackId={trackId} fullPage />;
}
