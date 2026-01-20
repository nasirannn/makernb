import { FeaturePermissionsProvider } from "@/contexts/FeaturePermissionsContext";

export default function TrackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeaturePermissionsProvider>
      {children}
    </FeaturePermissionsProvider>
  );
}
