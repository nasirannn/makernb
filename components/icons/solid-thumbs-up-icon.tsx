import React from 'react';

interface SolidThumbsUpIconProps {
  className?: string;
}

export function SolidThumbsUpIcon({ className = 'h-3.5 w-3.5 fill-current' }: SolidThumbsUpIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M1 21h4V9H1v12zm20-13h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.82 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2z" />
    </svg>
  );
}
