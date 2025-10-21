import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";

import { ThemeProvider } from "@/context/ThemeContext";
import Image from "next/image";
import React from "react";

const VISUAL_BG_IMAGE = '/images/grid-image/61729.jpg';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative z-1 w-screen h-screen overflow-hidden p-6 sm:p-0 bg-white dark:bg-gray-900">
      <ThemeProvider>
        <div className="relative flex flex-col lg:flex-row w-full h-full justify-center dark:bg-gray-900">
          
          {/* 1. Content/Form Section (Left) */}
          {children}
          
          {/* 2. Visual/Image Section (Right) */}
          <div className="
            relative 
            hidden lg:block 
            lg:w-1/2 w-full h-full 
            bg-brand-950 dark:bg-white/5
          ">
            
            {/* Overlay Text Box */}
            <div className="
              absolute z-10 
              top-[40%] xl:left-[38%] left-[45%] 
              -translate-x-1/2 -translate-y-1/2 
              px-6 py-8 rounded-md 
              text-blue-950 dark:text-white 
              bg-white/50 dark:bg-blue-950/70
            ">
              <h1 className="text-5xl font-bold font-stretch-110%">
                Digital SPC System
              </h1>
              <h1 className="text-3xl text-nowrap font-semibold">
                PT PARKLAND WORLD INDONESIA
              </h1>
            </div>

            {/* Background Image */}
            <Image 
              src={VISUAL_BG_IMAGE} 
              alt='Visual background of a factory or equipment' // Slightly better alt text
              fill 
              className="object-cover" 
            />
          </div>
          
          {/* 3. Theme Toggler (Fixed Position) */}
          <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
            <ThemeTogglerTwo />
          </div>
        </div>
      </ThemeProvider>
    </main>
  );
}