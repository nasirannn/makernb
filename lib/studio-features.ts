import type { MusicType } from "@/types/music";

export type StudioFeatureKey =
  | "music-generator"
  | "music-extender"
  | "music-cover"
  | "mashup"
  | "add-track"
  | "add-vocal"
  | "add-melody";

export interface StudioFeatureDefinition {
  key: StudioFeatureKey;
  label: string;
  path: string;
  description: string;
  musicTypes: MusicType[];
}

export const DEFAULT_STUDIO_FEATURE: StudioFeatureKey = "music-generator";

export const STUDIO_FEATURES: StudioFeatureDefinition[] = [
  {
    key: "music-generator",
    label: "Music Generator",
    path: "/music-generator",
    description: "Create songs from prompts and styles.",
    musicTypes: ["generated"],
  },
  {
    key: "music-extender",
    label: "Music Extender",
    path: "/music-extender",
    description: "Upload audio and continue it into a longer track.",
    musicTypes: ["upload_extend", "extended"],
  },
  {
    key: "music-cover",
    label: "Music Cover",
    path: "/music-cover",
    description: "Upload audio and create a cover-style version.",
    musicTypes: ["upload_cover"],
  },
  {
    key: "mashup",
    label: "Mashup",
    path: "/mashup",
    description: "Combine two uploaded tracks into one mashup.",
    musicTypes: ["upload_mashup"],
  },
  {
    key: "add-track",
    label: "Add Track",
    path: "/add-track",
    description: "Add vocals or melody to an uploaded track.",
    musicTypes: ["upload_vocal", "upload_melody"],
  },
  {
    key: "add-vocal",
    label: "Add Vocal",
    path: "/add-vocal",
    description: "Generate vocals on top of uploaded instrumental audio.",
    musicTypes: ["upload_vocal"],
  },
  {
    key: "add-melody",
    label: "Add Melody",
    path: "/add-melody",
    description: "Generate instrumental accompaniment for uploaded vocal audio.",
    musicTypes: ["upload_melody"],
  },
];

const studioFeatureMap = new Map<StudioFeatureKey, StudioFeatureDefinition>(
  STUDIO_FEATURES.map((feature) => [feature.key, feature])
);

export function isStudioFeatureKey(value: string): value is StudioFeatureKey {
  return studioFeatureMap.has(value as StudioFeatureKey);
}

export function getStudioFeatureFromSegment(segment: string): StudioFeatureKey | null {
  return isStudioFeatureKey(segment) ? segment : null;
}

export function getStudioFeatureDefinition(feature: StudioFeatureKey): StudioFeatureDefinition {
  return studioFeatureMap.get(feature) ?? studioFeatureMap.get(DEFAULT_STUDIO_FEATURE)!;
}

export function getStudioFeaturePath(feature: StudioFeatureKey): string {
  return getStudioFeatureDefinition(feature).path;
}

export function getStudioFeatureMusicTypes(feature: StudioFeatureKey): MusicType[] {
  return getStudioFeatureDefinition(feature).musicTypes;
}

function isPathMatch(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isStudioFeaturePath(pathname?: string | null): boolean {
  if (!pathname) return false;
  return STUDIO_FEATURES.some((feature) => isPathMatch(pathname, feature.path));
}

export function isStudioAreaPath(pathname?: string | null): boolean {
  return isStudioFeaturePath(pathname);
}
