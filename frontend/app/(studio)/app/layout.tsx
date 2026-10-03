import { Sidebar } from "@/components/studio/Sidebar";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <Sidebar />
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
