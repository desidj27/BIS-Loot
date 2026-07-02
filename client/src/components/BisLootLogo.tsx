interface BisLootLogoProps {
  className?: string;
  size?: number;
}

export default function BisLootLogo({ className, size = 48 }: BisLootLogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="1" y="1" width="46" height="46" rx="4" fill="#171411" stroke="#5c534a" strokeWidth="2" />
      <path
        d="M24 10c-5.5 0-10 3.6-10 8v2h20v-2c0-4.4-4.5-8-10-8Z"
        fill="#3d3020"
        stroke="#8a7355"
        strokeWidth="1.5"
      />
      <path
        d="M14 20h20l-2 18H16L14 20Z"
        fill="#241c14"
        stroke="#c47b1a"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 26h8M22 32h4"
        stroke="#e5b56e"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="14" r="2" fill="#e5b56e" />
    </svg>
  );
}
