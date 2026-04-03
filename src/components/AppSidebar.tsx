import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, PlusCircle, BarChart3, LogOut, Menu, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/articles", icon: FileText, label: "Articles" },
  { to: "/articles/new", icon: PlusCircle, label: "New Article" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/doi-sync/review", icon: RefreshCw, label: "DOI Review" },
];

const AppSidebar = () => {
  const { signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border/70 px-4 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm">
          <span className="text-sm font-bold text-sidebar-primary-foreground">L</span>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[1.05rem] font-semibold leading-none text-sidebar-foreground">LO&P3D</h2>
          <p className="mt-1 truncate text-sm leading-none text-sidebar-foreground/72">Systematic Review</p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 px-2.5 py-3.5">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === "/"
            ? location.pathname === "/"
            : location.pathname === to || location.pathname.startsWith(to + "/");

          return (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive
                  ? "bg-sidebar-accent/75 text-sidebar-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border))] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r-full before:bg-sidebar-ring"
                  : "text-sidebar-foreground/78 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-sidebar-ring" : "text-sidebar-foreground/72 group-hover:text-sidebar-foreground")} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border/70 px-2.5 py-3">
        <button
          onClick={signOut}
          className="group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base text-sidebar-foreground/72 transition-colors hover:bg-sidebar-accent/45 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <LogOut className="h-[18px] w-[18px] text-sidebar-foreground/72 group-hover:text-sidebar-foreground" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b bg-background px-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </Button>
        <span className="ml-2 font-semibold text-foreground">LO&P3D</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-sidebar-border/70 bg-sidebar text-sidebar-foreground shadow-[0_12px_30px_-12px_rgba(3,12,24,0.72)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Navigation menu"
            aria-modal="true"
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col border-r border-sidebar-border/70 bg-sidebar text-sidebar-foreground lg:flex">
        {sidebarContent}
      </aside>
    </>
  );
};

export default AppSidebar;
