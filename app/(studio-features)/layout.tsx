"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { FeaturePermissionsProvider } from "@/contexts/FeaturePermissionsContext";
import { FeatureWorkspaceSection } from "@/components/layout/sections/studio";
import { MusicGeneratorPanel } from "@/components/ui/feature-panels/music-generator-panel";
import { MusicExtenderPanel } from "@/components/ui/feature-panels/music-extender-panel";
import { MusicCoverPanel } from "@/components/ui/feature-panels/music-cover-panel";
import { MashupPanel } from "@/components/ui/feature-panels/mashup-panel";
import { AddTrackPanel } from "@/components/ui/feature-panels/add-track-panel";
import { AddVocalPanel } from "@/components/ui/feature-panels/add-vocal-panel";
import { AddMelodyPanel } from "@/components/ui/feature-panels/add-melody-panel";
import {
  type StudioFeatureKey,
  getStudioFeatureFromPathname,
} from "@/lib/studio-features";

const FEATURE_WORKSPACE_CONFIG: Record<
  StudioFeatureKey,
  {
    FeaturePanel:
      | typeof MusicGeneratorPanel
      | typeof MusicExtenderPanel
      | typeof MusicCoverPanel
      | typeof MashupPanel
      | typeof AddTrackPanel
      | typeof AddVocalPanel
      | typeof AddMelodyPanel;
    panelMode: "simple" | "custom";
    lockPanelMode: boolean;
  }
> = {
  "music-generator": {
    FeaturePanel: MusicGeneratorPanel,
    panelMode: "simple",
    lockPanelMode: false,
  },
  "music-extender": {
    FeaturePanel: MusicExtenderPanel,
    panelMode: "custom",
    lockPanelMode: true,
  },
  "music-cover": {
    FeaturePanel: MusicCoverPanel,
    panelMode: "custom",
    lockPanelMode: true,
  },
  mashup: {
    FeaturePanel: MashupPanel,
    panelMode: "custom",
    lockPanelMode: true,
  },
  "add-track": {
    FeaturePanel: AddTrackPanel,
    panelMode: "custom",
    lockPanelMode: true,
  },
  "add-vocal": {
    FeaturePanel: AddVocalPanel,
    panelMode: "custom",
    lockPanelMode: true,
  },
  "add-melody": {
    FeaturePanel: AddMelodyPanel,
    panelMode: "custom",
    lockPanelMode: true,
  },
};

interface StudioFeaturePagesLayoutProps {
  children: React.ReactNode;
}

export default function StudioFeaturePagesLayout({ children }: StudioFeaturePagesLayoutProps) {
  const pathname = usePathname();
  const feature = getStudioFeatureFromPathname(pathname);

  if (!feature) {
    return <>{children}</>;
  }

  const config = FEATURE_WORKSPACE_CONFIG[feature];

  return (
    <FeaturePermissionsProvider>
      <FeatureWorkspaceSection
        feature={feature}
        FeaturePanel={config.FeaturePanel}
        panelMode={config.panelMode}
        lockPanelMode={config.lockPanelMode}
      />
    </FeaturePermissionsProvider>
  );
}
