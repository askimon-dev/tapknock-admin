import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TapKnock • Admin Console & Analytics',
  description: 'Manage TapKnock smart doorbell system, track live activity, and dispatch targeted push notifications',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-darkest text-slate-100 antialiased min-h-screen selection:bg-brand-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
