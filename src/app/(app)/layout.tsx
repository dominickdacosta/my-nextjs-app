import AppShell from "@/components/app-shell";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell isPreview={process.env.VERCEL_ENV === "preview"}>
      {children}
    </AppShell>
  );
}
