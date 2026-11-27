import type { Metadata, Viewport } from 'next';

import { Toaster } from '@/components/ui/sonner';
import { APP_COMPANY, APP_DESCRIPTION, APP_NAME } from '@/lib/constants';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_COMPANY}`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
