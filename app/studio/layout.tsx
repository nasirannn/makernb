import { FeaturePermissionsProvider } from "@/contexts/FeaturePermissionsContext";

export default function StudioLayout({
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
