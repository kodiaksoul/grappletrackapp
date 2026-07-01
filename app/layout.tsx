import './globals.css';
import AuthGuard from './AuthGuard';

export const metadata = {
  title: 'GrappleTracker',
  description: 'BJJ Progression Tracker & Scouting Engine',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const color = localStorage.getItem('theme-color') || 'cool';
                  const brightness = localStorage.getItem('theme-brightness') || 'night';
                  document.documentElement.setAttribute('data-theme', color + '-' + brightness);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-bg-main text-text-primary min-h-screen antialiased" suppressHydrationWarning>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
