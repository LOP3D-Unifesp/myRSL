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
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <span className="text-sm font-bold text-sidebar-primary-foreground">L</span>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-sidebar-foreground">LO&P3D</h2>
          <p className="text-[10px] text-sidebar-foreground/60">Systematic Review</p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to ||
            (to === "/articles" && location.pathname === "/articles") ||
            (to !== "/" && to !== "/articles" && location.pathname.startsWith(to));

          return (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive
                  ? "border-sidebar-primary/40 bg-sidebar-accent text-sidebar-foreground shadow-sm"
                  : "border-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground")} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <LogOut className="h-4 w-4" />
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
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
      <aside className="hidden lg:flex fixed left-0 top-0 z-30 h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {sidebarContent}
      </aside>
    </>
  );
};

export default AppSidebar;
