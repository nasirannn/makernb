"use client";

import { FeatureWorkspaceSection } from "@/components/layout/sections/studio";
import { AddMelodyPanel } from "@/components/ui/feature-panels/add-melody-panel";

export const AddMelodySection = () => (
  <FeatureWorkspaceSection
    feature="add-melody"
    FeaturePanel={AddMelodyPanel}
    panelMode="custom"
    lockPanelMode={true}
  />
);
