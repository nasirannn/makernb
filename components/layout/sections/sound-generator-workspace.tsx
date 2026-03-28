"use client";

import { FeatureWorkspaceSection } from "@/components/layout/sections/studio";
import { SoundGeneratorPanel } from "@/components/ui/feature-panels/sound-generator-panel";

export const SoundGeneratorSection = () => (
  <FeatureWorkspaceSection
    feature="sound-generator"
    FeaturePanel={SoundGeneratorPanel}
    panelMode="simple"
    lockPanelMode={true}
  />
);
