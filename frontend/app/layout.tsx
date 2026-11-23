import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: '72 дугаар сургууль Багш систем',
  description: 'Багш ажилчдын удирдлагын систем',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn">
      <head>
        <link rel="preload" href="/login-background.webp" as="image" type="image/webp" fetchPriority="high" />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}