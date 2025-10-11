/**
 * Studio Constants
 * Constants used across studio components
 */

// Tempo keywords for text processing
export const TEMPO_KEYWORDS = ['slow', 'moderate', 'medium'];

// Common button CSS classes
export const BUTTON_CLASSES = {
  category: "inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium rounded-lg transition-all duration-200 text-sm",
  option: "inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
  play: "ml-1 p-1 hover:bg-white/20 rounded transition-colors"
};

// Common style classes for different states
export const STYLES = {
  selected: "bg-primary text-primary-foreground",
  unselected: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
  expanded: "bg-primary/20 border-transparent text-primary shadow-sm",
  collapsed: "bg-muted/30 text-foreground hover:bg-muted/50"
};

// BPM values for different tempo modes
export const BPM_VALUES = {
  slow: [60, 65, 70, 75, 80],
  moderate: [85, 90, 95, 100],
  medium: [105, 110, 115, 120]
};
