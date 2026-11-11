import type { Metadata } from 'next';
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
      <body>
        {children}
      </body>
    </html>
  );
}