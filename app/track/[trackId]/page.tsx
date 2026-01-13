import type { Metadata } from "next";
import { TrackDetailView } from "@/components/ui/track-detail-view";

interface TrackDetailPageProps {
  params: {
    trackId: string;
  };
}

export async function generateMetadata({ params }: TrackDetailPageProps): Promise<Metadata> {
  const title = "Track Detail | MakeRNB";
  return {
    title,
    description: "Listen to your AI-generated R&B song on the dedicated detail page.",
    alternates: {
      canonical: `https://makernb.com/track/${params.trackId}`,
    },
  };
}

export default function TrackDetailPage({ params }: TrackDetailPageProps) {
  return <TrackDetailView trackId={params.trackId} fullPage />;
}
