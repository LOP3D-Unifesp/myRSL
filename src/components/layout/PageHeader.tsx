import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  titleIcon?: ReactNode;
};

const PageHeader = ({ title, subtitle, actions, titleIcon }: PageHeaderProps) => {
  return (
    <header className="page-header">
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
