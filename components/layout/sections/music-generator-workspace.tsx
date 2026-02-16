"use client";

import { FeatureWorkspaceSection } from "@/components/layout/sections/studio";
import { MusicGeneratorPanel } from "@/components/ui/feature-panels/music-generator-panel";

export const MusicGeneratorSection = () => (
  <FeatureWorkspaceSection
    feature="music-generator"
    FeaturePanel={MusicGeneratorPanel}
    panelMode="simple"
    lockPanelMode={false}
  />
);
