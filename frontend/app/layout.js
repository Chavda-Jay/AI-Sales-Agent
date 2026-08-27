import { Inter, Sora, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata = {
  title: 'AI Sales Agent Demo',
  description: 'Live AI sales conversation powered by your backend.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
