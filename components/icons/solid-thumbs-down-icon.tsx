interface SolidThumbsDownIconProps {
  className?: string;
}

export function SolidThumbsDownIcon({ className = 'h-3.5 w-3.5 fill-current' }: SolidThumbsDownIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M14.243 21.312c-.462 0-.902-.206-1.198-.568l-1.923-2.35a1.875 1.875 0 0 1-.329-1.67l1.303-4.558H5.487a2.625 2.625 0 0 1-2.52-3.363l1.5-5.25a2.625 2.625 0 0 1 2.52-1.887h8.546c.836 0 1.544.619 1.655 1.448l.701 5.25a2.625 2.625 0 0 1-2.603 2.973h-1.02l-1.458 5.098 1.705 2.083a1.5 1.5 0 0 1-1.27 2.396Z" />
      <path d="M19.125 1.688h1.5c.621 0 1.125.504 1.125 1.125v8.625c0 .621-.504 1.125-1.125 1.125h-1.5a1.125 1.125 0 0 1-1.125-1.125V2.813c0-.621.504-1.125 1.125-1.125Z" />
    </svg>
  );
}
