
'use client'; // Make RootLayout a Client Component to use hooks

import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed font to Inter
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
// Corrected icon import
import { Cog, LayoutDashboard, Target, ShieldCheck, BriefcaseBusiness } from 'lucide-react'; // Added Target icon for CRM, ShieldCheck for Admin, BriefcaseBusiness for System Logo
import { useEffect, useState } from 'react'; // Import hooks
import { getEnvironmentSettings, type EnvironmentSettings } from '@/db/db'; // Import settings
import Image from 'next/image'; // Import Next Image
import { AuthProvider } from '@/contexts/AuthContext'; // Corrected import path (use named import)
import AuthNav from '@/components/AuthNav'; // Import AuthNav for dynamic links
import { ThemeProvider } from "@/components/ThemeProvider"; // Import ThemeProvider
import { ThemeToggle } from "@/components/ThemeToggle"; // Import ThemeToggle

const inter = Inter({ subsets: ['latin'] });

// Metadata cannot be exported from a Client Component directly in App Router.
// Move this to a dedicated metadata export or handle differently if needed.
// export const metadata: Metadata = {
//   title: 'Genius ERP+CRM', // Updated title
//   description: 'Local Genius ERP for Architecture Projects',
// };

// Helper to get data URL (avoids repetition, handles client-side Blob)
const getImageDataUrl = (imageData?: Blob | string): string | null => {
    if (!imageData) return null;
    if (typeof imageData === 'string') {
        return imageData; // Assume it's already a data URL
    } else if (typeof window !== 'undefined' && imageData instanceof Blob) {
         try {
           // Only use createObjectURL on the client
           return URL.createObjectURL(imageData);
         } catch (e) {
           console.error("Error creating object URL:", e);
           return null;
         }
    }
    return null;
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoadingLogo, setIsLoadingLogo] = useState(true);

  // Fetch settings on the client-side after mount
  useEffect(() => {
    let currentLogoUrl: string | null = null;

    const loadLogo = async () => {
      try {
        setIsLoadingLogo(true);
        // const settings = await getSettings(); // This function was removed, fetch from AuthContext if needed
        // For now, we don't fetch the logo here, assuming AuthProvider handles environment setup
        // If logo needs to be displayed globally regardless of env, fetch from mainDb settings maybe?
        setIsLoadingLogo(false);
      } catch (error) {
        console.error("Failed to load logo setting:", error);
        setLogoUrl(null); // Ensure logoUrl is null on error
      } finally {
        setIsLoadingLogo(false);
      }
    };

    // loadLogo(); // Temporarily disable logo loading from layout

    // Cleanup function to revoke URL if it's a blob URL
    return () => {
       if (currentLogoUrl && currentLogoUrl.startsWith('blob:')) {
         URL.revokeObjectURL(currentLogoUrl);
       }
     };
  }, []); // Empty dependency array means this runs once on mount


  return (
     // No whitespace or comments immediately inside <html>
     <html lang="en" suppressHydrationWarning={true}>{/* Keep suppressHydrationWarning */}
      <body className={`${inter.className} antialiased`}>
         <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
         >
           <AuthProvider> {/* Wrap content with AuthProvider */}
              {/* Basic Header Example */}
             <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
               <div className="container flex h-14 items-center justify-between px-4 md:px-6">
                  {/* Use a div to wrap the logo and apply padding/margin */}
                 <div className="flex items-center gap-2 pl-2 sm:pl-0">
                   {/* System Logo/Icon */}
                    <BriefcaseBusiness className="h-5 w-5 text-primary shrink-0" />
                   <Link href="/" className="flex items-center space-x-2">
                     <span className="font-bold inline-block">Genius ERP+CRM</span> {/* Updated name */}
                   </Link>
                   {/* Separator */}
                    <div className="h-6 w-px bg-border mx-2 hidden sm:block"></div>
                    {/* User Uploaded Logo (Client-side rendering) */}
                    {/* {isLoadingLogo ? (
                        <div className="h-6 w-6 bg-muted rounded-sm animate-pulse"></div> // Placeholder while loading
                    ) : logoUrl ? (
                       <Image
                           src={logoUrl}
                           alt="Logo da Empresa"
                           width={24} // Adjust size as needed
                           height={24} // Adjust size as needed
                           className="h-6 w-auto object-contain rounded-sm" // Maintain aspect ratio
                           unoptimized={logoUrl.startsWith('blob:')} // Avoid optimization for blob URLs
                       />
                   ) : null} */} {/* Render nothing if no logo */}
                 </div>
                  {/* Simplified Navigation & Theme Toggle */}
                  <div className="flex items-center gap-2">
                      <nav className="flex items-center space-x-1 sm:space-x-2"> {/* Reduced spacing slightly */}
                         {/* Render AuthNav which contains dynamic links based on auth state */}
                        <AuthNav />
                      </nav>
                      <ThemeToggle /> {/* Add the Theme Toggle button */}
                  </div>
               </div>
             </header>

             {/* Adjusted main to account for header height */}
            <main className="min-h-[calc(100vh-3.5rem)] bg-background"> {/* 3.5rem = h-14 */}
              {children}
            </main>
            <Toaster />
           </AuthProvider>
         </ThemeProvider>
      </body>
    </html>
  );
}
