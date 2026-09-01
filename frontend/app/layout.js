import { Inter, Sora, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
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
        <Toaster 
          position="top-right" 
          toastOptions={{ 
            style: { background: '#1c2129', color: '#e6edf3', border: '1px solid #2b3140' } 
          }} 
        />
        {children}
      </body>
    </html>
  );
}
