export function CompassMark({
  size = 36,
  animated = false,
}: {
  size?: number;
  animated?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-brass ${animated ? "compass-mark-active" : ""}`}
    >
      <path
        d="M18 3.2 20.4 15.6 32.8 18 20.4 20.4 18 32.8 15.6 20.4 3.2 18 15.6 15.6Z"
        fill="currentColor"
        opacity="0.92"
      />
      <path
        d="M18 8.5 19.1 16.9 27.5 18 19.1 19.1 18 27.5 16.9 19.1 8.5 18 16.9 16.9Z"
        fill="var(--paper)"
        opacity="0.55"
      />
    </svg>
  );
}
