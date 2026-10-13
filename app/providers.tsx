'use client'

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const isPublicRoute = pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/invite");
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <AuthGuard>{children}</AuthGuard>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
