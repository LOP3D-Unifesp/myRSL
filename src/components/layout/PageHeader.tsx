import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  titleIcon?: ReactNode;
  variant?: "default" | "emphasis";
  compact?: boolean;
};

const PageHeader = ({
  title,
  subtitle,
  actions,
  titleIcon,
  variant = "default",
  compact = false,
}: PageHeaderProps) => {
  return (
    <header className={cn("page-header", variant === "emphasis" && "page-header-emphasis", compact && "page-header-compact")}>
      <div className="page-header-copy">
        <h1 className="page-title">
          {titleIcon}
          <span>{title}</span>
        </h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
};

export default PageHeader;
