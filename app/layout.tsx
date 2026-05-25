import './globals.css';
import Navigation from '../components/Navigation';

export const metadata = {
  title: 'GrappleTrack',
  description: 'BJJ Progression Tracker & Scouting Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-main text-primary min-h-screen antialiased flex flex-col md:flex-row" suppressHydrationWarning>
        <Navigation />
        <main className="flex-1 md:pl-64 pb-16 md:pb-0 min-h-screen">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
