import type { ReactNode } from 'react';

/**
 * Inline icons — Heroicons v2 outline (24x24, 1.75 stroke). There is no icon
 * library in this app on purpose: each glyph is one path, so a component per
 * icon costs less than a dependency.
 */
interface IconProps {
  className?: string;
}

function Icon({ className = 'h-5 w-5', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function Path({ d }: { d: string }) {
  return <path strokeLinecap="round" strokeLinejoin="round" d={d} />;
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </Icon>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <Path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="m4.5 12.75 6 6 9-13.5" />
    </Icon>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </Icon>
  );
}

export function ExclamationTriangleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </Icon>
  );
}

export function ExclamationCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
    </Icon>
  );
}

export function InformationCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </Icon>
  );
}

export function XMarkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M6 18 18 6M6 6l12 12" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 4.5v15m7.5-7.5h-15" />
    </Icon>
  );
}

export function ArrowTopRightOnSquareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </Icon>
  );
}
