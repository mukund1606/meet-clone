import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";

import { TRPCReactProvider } from "@/trpc/react";
import { HydrateClient } from "@/trpc/server";

export const metadata = {
  title: "SSA Competition",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="dark">
        <TRPCReactProvider>
          <HydrateClient>
            {children}
            <Toaster
              richColors
              closeButton
              duration={3000}
              position="top-left"
            />
          </HydrateClient>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
