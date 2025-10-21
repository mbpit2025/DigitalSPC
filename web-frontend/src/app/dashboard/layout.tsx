"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import React from "react";
import { DashboardDataProvider } from "@/context/DashboardDataContext";
import { HistoryProvider } from "@/context/HistoryContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[290px]"
    : "lg:ml-[90px]";

  return (
    <DashboardDataProvider>
      <main className="min-h-screen xl:flex">
        <AppSidebar />
        <Backdrop />
        <section
          className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
          >
          <AppHeader />
          <HistoryProvider>
            <div className="p-4 mx-auto w-full md:p-6">{children}</div>
          </HistoryProvider>
        </section>
      </main>
    </DashboardDataProvider>
  );
}
