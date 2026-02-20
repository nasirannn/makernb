import type { Metadata } from "next";
import TrackDetailPage, { generateMetadata as generateTrackMetadata } from "../../../track/[trackId]/page";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocaleTrackDetailPageProps {
  params: Promise<{
    locale: string;
    trackId: string;
  }>;
}

export async function generateMetadata({ params }: LocaleTrackDetailPageProps): Promise<Metadata> {
  const { locale: localeParam, trackId } = await params;
  const locale = resolveRouteLocale(localeParam);
  const baseMetadata = await generateTrackMetadata({ params: Promise.resolve({ trackId }) });

  return applyLocaleMetadata(baseMetadata, locale, `/track/${trackId}`);
}

export default TrackDetailPage;
