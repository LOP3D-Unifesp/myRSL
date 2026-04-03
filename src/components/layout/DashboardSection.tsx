import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DashboardSectionProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  variant?: "default" | "priority" | "subtle";
  compact?: boolean;
};

const DashboardSection = ({
  title,
  subtitle,
  action,
  children,
  variant = "default",
  compact = false,
}: DashboardSectionProps) => {
  return (
    <section
      className={cn(
        "dashboard-section",
        variant === "priority" && "dashboard-section-priority",
        variant === "subtle" && "dashboard-section-subtle",
        compact && "dashboard-section-compact",
      )}
    >
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-serif text-foreground">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
};

export default DashboardSection;
