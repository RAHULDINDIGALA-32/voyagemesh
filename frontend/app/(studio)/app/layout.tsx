import { Sidebar } from "@/components/studio/Sidebar";
import { GlobalSearch } from "@/components/studio/GlobalSearch";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <Sidebar />
      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
        {children}
        <GlobalSearch />
      </div>
    </div>
  );
}
