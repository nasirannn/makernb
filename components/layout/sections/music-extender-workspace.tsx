"use client";

import { FeatureWorkspaceSection } from "@/components/layout/sections/studio";
import { MusicExtenderPanel } from "@/components/ui/feature-panels/music-extender-panel";

export const MusicExtenderSection = () => (
  <FeatureWorkspaceSection
    feature="music-extender"
    FeaturePanel={MusicExtenderPanel}
    panelMode="custom"
    lockPanelMode={true}
  />
);
