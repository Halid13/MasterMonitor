import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MasterMonitor - Dashboard IT',
  description: 'Gestion centralisée de l\'infrastructure informatique',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
