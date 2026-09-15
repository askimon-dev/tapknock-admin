import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { ThemeProvider, COOKIE_THEME_NAME } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'TapKnock • Admin Console & Analytics',
  description: 'Manage TapKnock smart doorbell system, track live activity, and dispatch targeted push notifications',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '192x192' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.png',
    shortcut: '/favicon.ico',
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const savedTheme = cookieStore.get(COOKIE_THEME_NAME)?.value;
  const initialTheme = savedTheme === 'light' ? 'light' : 'dark';

  return (
    <html lang="en" className={initialTheme} style={{ colorScheme: initialTheme }}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var m = document.cookie.match(/(^| )tk_admin_theme=([^;]+)/);
                  var t = m ? m[2] : '${initialTheme}';
                  if (t === 'light' || t === 'dark') {
                    document.documentElement.className = t;
                    document.documentElement.style.colorScheme = t;
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-surface-darkest text-slate-100 antialiased min-h-screen selection:bg-brand-600 selection:text-white">
        <ThemeProvider initialTheme={initialTheme}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
