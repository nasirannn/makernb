/**
 * Studio Constants
 * Constants used across studio components
 */

// Tempo keywords for text processing
export const TEMPO_KEYWORDS = ['slow', 'moderate', 'medium'];

// Common button CSS classes
export const BUTTON_CLASSES = {
  category: "inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium tracking-tight rounded-lg transition-all duration-200 text-sm",
  option: "inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200",
  play: "ml-1 p-1 hover:bg-white/20 rounded transition-colors"
};

// Common style classes for different states
export const STYLES = {
  selected: "bg-primary text-primary-foreground",
  unselected: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
  expanded: "border border-primary/50 text-primary bg-transparent hover:bg-primary/5",
  collapsed: "border border-border/30 text-muted-foreground/70 bg-transparent hover:border-primary/50 hover:text-primary/80"
};

// BPM values for different tempo modes
export const BPM_VALUES = {
  slow: [60, 65, 70, 75, 80],
  moderate: [85, 90, 95, 100],
  medium: [105, 110, 115, 120]
};
