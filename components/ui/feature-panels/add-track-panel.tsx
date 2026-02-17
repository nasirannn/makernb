"use client";

import React from "react";

import { AddMelodyPanel } from "@/components/ui/feature-panels/add-melody-panel";
import {
  AddVocalPanel,
  type FeatureCreatePanelProps as AddTrackPanelProps,
} from "@/components/ui/feature-panels/add-vocal-panel";

type AddTrackTab = "track" | "melody";

export const AddTrackPanel = (props: AddTrackPanelProps) => {
  const [activeTab, setActiveTab] = React.useState<AddTrackTab>("track");

  const panelTabs = (
    <div className="app-card-muted flex w-full items-center rounded-2xl p-1 gap-1 bg-foreground/5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-white/10">
      <button
        type="button"
        onClick={() => setActiveTab("track")}
        className={`flex-1 h-10 px-4 text-xs md:text-sm font-semibold transition-colors duration-200 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          activeTab === "track"
            ? "bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
            : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
        }`}
        aria-pressed={activeTab === "track"}
      >
        Vocal
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("melody")}
        className={`flex-1 h-10 px-4 text-xs md:text-sm font-semibold transition-colors duration-200 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          activeTab === "melody"
            ? "bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
            : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
        }`}
        aria-pressed={activeTab === "melody"}
      >
        Melody
      </button>
    </div>
  );

  if (activeTab === "track") {
    return (
      <AddVocalPanel
        {...props}
        panelTitle="Add Track"
        panelTabs={panelTabs}
        allowedUploadIntents={["vocal"]}
        forcedUploadIntent="vocal"
      />
    );
  }

  return (
    <AddMelodyPanel
      {...props}
      panelTitle="Add Track"
      panelTabs={panelTabs}
      allowedUploadIntents={["melody"]}
      forcedUploadIntent="melody"
    />
  );
};
