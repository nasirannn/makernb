"use client";

import { FeatureWorkspaceSection } from "@/components/layout/sections/studio";
import { MashupPanel } from "@/components/ui/feature-panels/mashup-panel";

export const MashupSection = () => (
  <FeatureWorkspaceSection
    feature="mashup"
    FeaturePanel={MashupPanel}
    panelMode="custom"
    lockPanelMode={true}
  />
);
