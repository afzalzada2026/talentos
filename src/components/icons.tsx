import type { ReactNode } from "react";

interface P {
  className?: string;
}

const S = ({ className = "h-5 w-5", children }: P & { children: ReactNode }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const LogoMark = ({ className = "h-9 w-9" }: P) => (
  <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#144431" />
    <path d="M8 21l5-5 3 3 8-8" stroke="#DCA44F" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 25.5h16" stroke="#3F8F6E" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const IconScan = (p: P) => (
  <S {...p}>
    <path d="M4 4.5h16l-6.2 7.2v5.1L10.2 19v-7.3L4 4.5z" />
    <path d="M17.5 15.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" strokeWidth="1.4" />
  </S>
);

export const IconDoc = (p: P) => (
  <S {...p}>
    <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v4h4" />
    <path d="M9.5 12h5M9.5 15.5h5M9.5 8.5h2" />
  </S>
);

export const IconTrack = (p: P) => (
  <S {...p}>
    <rect x="3.5" y="4" width="5" height="16" rx="1.2" />
    <rect x="10" y="4" width="5" height="10.5" rx="1.2" />
    <rect x="16.5" y="4" width="5" height="7" rx="1.2" />
    <path d="M12.5 18.5l1.2 1.2 2.2-2.4" />
  </S>
);

export const IconGear = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
  </S>
);

export const IconKey = (p: P) => (
  <S {...p}>
    <circle cx="8" cy="12" r="3.4" />
    <path d="M11.4 12h9M17 12v3.2M20.4 12v2.2" />
  </S>
);

export const IconSpark = (p: P) => (
  <S {...p}>
    <path d="M12 3.5l1.9 5.4 5.4 1.9-5.4 1.9-1.9 5.4-1.9-5.4-5.4-1.9 5.4-1.9L12 3.5z" />
    <path d="M19 16.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" strokeWidth="1.3" />
  </S>
);

export const IconWand = (p: P) => (
  <S {...p}>
    <path d="M4 20L15.5 8.5M13.5 6.5l4-4 4 4-4 4-4-4z" />
    <path d="M7 5.5l.6 1.5 1.5.6-1.5.6L7 9.7l-.6-1.5-1.5-.6 1.5-.6.6-1.5z" strokeWidth="1.3" />
  </S>
);

export const IconDownload = (p: P) => (
  <S {...p}>
    <path d="M12 3.5v10.5M8 10.5l4 4 4-4" />
    <path d="M4.5 16.5v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
  </S>
);

export const IconUpload = (p: P) => (
  <S {...p}>
    <path d="M12 14V3.5M8 7.5l4-4 4 4" />
    <path d="M4.5 16.5v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
  </S>
);

export const IconCopy = (p: P) => (
  <S {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <path d="M5.5 15.5h-1a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </S>
);

export const IconPrint = (p: P) => (
  <S {...p}>
    <path d="M7 8V3.5h10V8" />
    <rect x="4" y="8" width="16" height="8.5" rx="1.5" />
    <path d="M7 13.5h10v7H7z" />
  </S>
);

export const IconPlus = (p: P) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);

export const IconTrash = (p: P) => (
  <S {...p}>
    <path d="M4.5 6.5h15M9.5 3.5h5M6.5 6.5l.8 13a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-13" />
    <path d="M10 10.5v6M14 10.5v6" />
  </S>
);

export const IconX = (p: P) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </S>
);

export const IconCheck = (p: P) => (
  <S {...p}>
    <path d="M4.5 12.5l5 5L19.5 6.5" />
  </S>
);

export const IconAlert = (p: P) => (
  <S {...p}>
    <path d="M12 3.5L2.5 20h19L12 3.5z" />
    <path d="M12 9.5v5M12 17.5v.2" />
  </S>
);

export const IconInfo = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.5v.2" />
  </S>
);

export const IconSearch = (p: P) => (
  <S {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15.2 15.2L20.5 20.5" />
  </S>
);

export const IconChevron = (p: P) => (
  <S {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </S>
);

export const IconArrow = (p: P) => (
  <S {...p}>
    <path d="M4 12h16M13.5 5.5L20 12l-6.5 6.5" />
  </S>
);

export const IconUserCheck = (p: P) => (
  <S {...p}>
    <circle cx="9" cy="7.5" r="3.5" />
    <path d="M3.5 20c.6-3.4 2.7-5.3 5.5-5.3s4.9 1.9 5.5 5.3" />
    <path d="M15 9.5l2 2 3.8-4" />
  </S>
);

export const IconEye = (p: P) => (
  <S {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </S>
);

export const IconEyeOff = (p: P) => (
  <S {...p}>
    <path d="M4 4l16 16" />
    <path d="M9.9 5.2A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17.6 17.6 0 0 1-3 3.9M6.1 8.3A16.9 16.9 0 0 0 2.5 12S6 19 12 19a9.3 9.3 0 0 0 3.9-.9" />
  </S>
);

export const IconRefresh = (p: P) => (
  <S {...p}>
    <path d="M4.5 12a7.5 7.5 0 0 1 13-5.2L20 9M20 4.5V9h-4.5" />
    <path d="M19.5 12a7.5 7.5 0 0 1-13 5.2L4 15M4 19.5V15h4.5" />
  </S>
);

export const IconInbox = (p: P) => (
  <S {...p}>
    <path d="M3.5 13.5L6 5.5h12l2.5 8" />
    <path d="M3.5 13.5h5l1.2 2.5h4.6l1.2-2.5h5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-4.5z" />
  </S>
);

export const IconCalendar = (p: P) => (
  <S {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="1.8" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    <path d="M7.5 13.5h3" />
  </S>
);

export const IconTable = (p: P) => (
  <S {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <path d="M3.5 9.5h17M9.5 9.5v10M15.5 9.5v10" />
  </S>
);

export const IconExternal = (p: P) => (
  <S {...p}>
    <path d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v10A2.5 2.5 0 0 0 6.5 20h10a2.5 2.5 0 0 0 2.5-2.5V14" />
    <path d="M14 4h6v6M20 4L11 13" />
  </S>
);
