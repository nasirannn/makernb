import { cn } from "@/lib/utils";

interface TrackCreatorProps {
  name?: string | null;
  fallbackLabel: string;
  className?: string;
}

export function TrackCreator({
  name,
  fallbackLabel,
  className,
}: TrackCreatorProps) {
  const displayName = name?.trim() || fallbackLabel;

  return (
    <p className={cn("mt-2.5 line-clamp-1 text-sm text-muted-foreground", className)}>
      by {displayName}
    </p>
  );
}
