// app/layout.tsx
import { ReactNode } from 'react';

// ✅ Ce fichier est requis par Next.js, mais il délègue tout le rendu HTML au layout [locale]
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}