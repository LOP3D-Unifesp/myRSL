import type { ReactNode } from "react";

type PageStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
};

const PageState = ({ title, description, icon, actions }: PageStateProps) => {
  return (
    <div className="page-state">
      {icon ? <div className="page-state-icon">{icon}</div> : null}
      <p className="page-state-title">{title}</p>
      {description ? <p className="page-state-description">{description}</p> : null}
      {actions ? <div className="page-state-actions">{actions}</div> : null}
    </div>
  );
};

export default PageState;
