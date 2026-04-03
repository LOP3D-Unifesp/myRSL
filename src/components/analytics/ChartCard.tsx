import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  subtitle,
  children,
  className,
  id,
  highlighted = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
  id?: string;
  highlighted?: boolean;
}) {
  return (
    <Card
      id={id}
      data-highlighted={highlighted ? "true" : "false"}
      className={cn(className, highlighted && "ring-2 ring-primary/45 ring-offset-2 ring-offset-background")}
    >
      <CardHeader className="space-y-1.5 pb-2">
        <CardTitle className="text-lg font-serif tracking-tight">{title}</CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
