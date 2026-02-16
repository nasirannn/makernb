"use client";

import { FeatureWorkspaceSection } from "@/components/layout/sections/studio";
import { AddTrackPanel } from "@/components/ui/feature-panels/add-track-panel";

export const AddTrackSection = () => (
  <FeatureWorkspaceSection
    feature="add-track"
    FeaturePanel={AddTrackPanel}
    panelMode="custom"
    lockPanelMode={true}
  />
);
