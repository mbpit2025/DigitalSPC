import './globals.css';
import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import Link from 'next/link';


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className='dark:bg-gray-900' suppressHydrationWarning={true}>
        <ThemeProvider>
          <SidebarProvider>
            {children}
          </SidebarProvider>
        </ThemeProvider>
      <footer className="bg-gray-200 dark:bg-gray-950/50 p-4 fixed bottom-0 w-full">
        <div className="container mx-auto text-center">
          <Link href="https://www.minzinc.com/smart-production.html" target="_blank" rel="noopener noreferrer">
            <p className="text-sm text-gray-600 dark:text-gray-600">
              &copy; {new Date().getFullYear()} Minz IOT Platform
            </p>
          </Link>
        </div>
      </footer>
      </body>
    </html>
  );
}
