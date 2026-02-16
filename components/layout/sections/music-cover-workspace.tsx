"use client";

import { FeatureWorkspaceSection } from "@/components/layout/sections/studio";
import { MusicCoverPanel } from "@/components/ui/feature-panels/music-cover-panel";

export const MusicCoverSection = () => (
  <FeatureWorkspaceSection
    feature="music-cover"
    FeaturePanel={MusicCoverPanel}
    panelMode="custom"
    lockPanelMode={true}
  />
);
