import { FeaturePermissionsProvider } from "@/contexts/FeaturePermissionsContext";

export default function LibraryLayout({
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
