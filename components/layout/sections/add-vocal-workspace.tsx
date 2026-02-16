"use client";

import { FeatureWorkspaceSection } from "@/components/layout/sections/studio";
import { AddVocalPanel } from "@/components/ui/feature-panels/add-vocal-panel";

export const AddVocalSection = () => (
  <FeatureWorkspaceSection
    feature="add-vocal"
    FeaturePanel={AddVocalPanel}
    panelMode="custom"
    lockPanelMode={true}
  />
);
