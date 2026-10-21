import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ねぎしや | シフトノート',
  description: 'ねぎしやの半月ごとの希望シフト入力',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
