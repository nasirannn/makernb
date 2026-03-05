import type { Metadata } from "next";
import SponsoredContentPolicyPage, {
  metadata as baseMetadata,
} from "../../sponsored-content-policy/page";
import { applyLocaleMetadata, resolveRouteLocale } from "@/lib/i18n/metadata";

interface LocaleSponsoredContentPolicyPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({
  params,
}: LocaleSponsoredContentPolicyPageProps): Promise<Metadata> {
  const { locale } = await params;
  return applyLocaleMetadata(
    baseMetadata,
    resolveRouteLocale(locale),
    "/sponsored-content-policy"
  );
}

export default SponsoredContentPolicyPage;
