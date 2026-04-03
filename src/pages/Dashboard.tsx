import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchArticleSummaries, syncCurrentUserDoiMetadata, type ArticleListItem } from "@/lib/articles";
import { formatCompactAuthors } from "@/lib/article-authors";
import { isFullyVerified } from "@/lib/article-verification";
import { saveDoiConflictReviewState } from "@/lib/doi-conflict-review";
import { buildCountryFrequencyMap } from "@/lib/country-normalization";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, Beaker, RefreshCw, PlusCircle, type LucideIcon, LayoutDashboard, ShieldCheck, ArrowRight, Clock3 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/layout/PageHeader";
import PageState from "@/components/layout/PageState";
import DashboardSection from "@/components/layout/DashboardSection";

type QueueItem = {
  article: ArticleListItem;
  priority: number;
  actionLabel: "Continue" | "Review" | "Open";
  actionTo: string;
  statusLabel: "Draft" | "Pending" | "Verified";
  tone: "warning" | "success";
};

function buildQueueItem(article: ArticleListItem): QueueItem {
  if (article.is_draft) {
    return {
      article,
      priority: 0,
      actionLabel: "Continue",
      actionTo: `/articles/${article.id}/edit`,
      statusLabel: "Draft",
      tone: "warning",
    };
  }

  if (!isFullyVerified(article)) {
    return {
      article,
      priority: 1,
      actionLabel: "Review",
      actionTo: `/articles/${article.id}`,
      statusLabel: "Pending",
      tone: "warning",
    };
  }

  return {
    article,
    priority: 2,
    actionLabel: "Open",
    actionTo: `/articles/${article.id}`,
    statusLabel: "Verified",
    tone: "success",
  };
}

function formatActivityDate(value: string | null): string {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getQueuePrimaryText(article: ArticleListItem): string {
  return formatCompactAuthors(article.author, article.first_author) + (article.year ? ` (${article.year})` : "");
}

function getQueueSecondaryText(article: ArticleListItem): string {
  return article.prosthesis_name || article.study_id || article.title || "No details";
}

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["articles"],
    queryFn: fetchArticleSummaries,
  });

  const totalArticles = articles.length;
  const draftCount = articles.filter((a) => a.is_draft).length;
  const pendingVerificationCount = articles.filter((a) => !a.is_draft && !isFullyVerified(a)).length;
  const uniqueCountries = Object.keys(buildCountryFrequencyMap(articles)).length;
  const validYearRows = articles.filter((a) => a.year != null);
  const avgYear = validYearRows.length
    ? Math.round(validYearRows.reduce((sum, article) => sum + (article.year ?? 0), 0) / validYearRows.length)
    : 0;

  const workQueue = useMemo(() => {
    return articles
      .map(buildQueueItem)
      .sort((a, b) => a.priority - b.priority || (new Date(b.article.created_at ?? 0).getTime() - new Date(a.article.created_at ?? 0).getTime()))
      .slice(0, 8);
  }, [articles]);

  const recentActivity = useMemo(() => {
    return [...articles]
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 6);
  }, [articles]);

  const handleSyncDois = async () => {
    setSyncing(true);
    try {
      const eligibleIds = articles.filter((a) => a.title).map((a) => a.id);
      if (eligibleIds.length === 0) {
        toast.info("No eligible articles found for metadata sync.");
        return;
      }

      toast.info(`Syncing DOI metadata for up to ${eligibleIds.length} article(s)...`);
      const data = await syncCurrentUserDoiMetadata({
        articleIds: eligibleIds,
        includeAbstract: true,
      });

      const updated = data.summary.updated_safe;
      const unchanged = data.summary.unchanged;
      const missingSource = data.summary.missing_source;
      const failed = data.summary.failed;
      const conflictFields = data.summary.conflict_fields;
      const conflictArticles = data.summary.conflict_articles;

      const summary = [`${updated} updated`];
      if (unchanged > 0) summary.push(`${unchanged} unchanged`);
      if (missingSource > 0) summary.push(`${missingSource} missing source`);
      if (failed > 0) summary.push(`${failed} failed`);
      if (conflictFields > 0) summary.push(`${conflictFields} conflicts`);
      toast.success(`DOI metadata sync complete: ${summary.join(", ")}`);

      if (data.conflictQueue.length > 0) {
        saveDoiConflictReviewState({
          createdAt: new Date().toISOString(),
          summary: data.summary,
          queue: data.conflictQueue,
          currentIndex: 0,
          started: false,
        });
        toast.info(`${conflictArticles} article(s) need manual review. Opening DOI Review...`);
        navigate("/doi-sync/review");
      }

      queryClient.invalidateQueries({ queryKey: ["articles"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "DOI metadata sync failed";
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  if (isLoading) {
    return <PageState title="Loading dashboard..." description="Gathering your latest article metrics." />;
  }

  if (articles.length === 0) {
    return (
      <div className="page-container">
        <PageHeader
          title="Dashboard"
          subtitle="Systematic review command center."
          titleIcon={<LayoutDashboard className="h-6 w-6 text-primary" />}
          actions={
            <Button asChild>
              <Link to="/articles/new">
                <PlusCircle className="mr-2 h-4 w-4" /> New Article
              </Link>
            </Button>
          }
        />

        <PageState
          icon={<FileText className="h-12 w-12" />}
          title="No articles yet"
          description="Create your first article to start the review workflow."
          actions={
            <Button asChild>
              <Link to="/articles/new">Get Started</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Dashboard"
        subtitle="Systematic review command center and work queue."
        titleIcon={<LayoutDashboard className="h-6 w-6 text-primary" />}
        variant="emphasis"
        actions={
          <>
            <Button asChild>
              <Link to="/articles/new">
                <PlusCircle className="mr-2 h-4 w-4" /> New Article
              </Link>
            </Button>
            <Button variant="outline" onClick={handleSyncDois} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing DOI..." : "Sync DOI Metadata"}
            </Button>
          </>
        }
      />

      <DashboardSection
        title="Snapshot"
        subtitle="Quick indicators for current review status."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/analytics">Open Analytics</Link>
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={FileText} label="Total Articles" value={totalArticles} helper="All records" tone="default" to="/articles" />
          <StatCard icon={Beaker} label="Drafts" value={draftCount} helper={draftCount > 0 ? "Need completion" : "No pending drafts"} tone={draftCount > 0 ? "warning" : "default"} to="/articles?status=draft" />
          <StatCard icon={ShieldCheck} label="Pending Verification" value={pendingVerificationCount} helper={pendingVerificationCount > 0 ? "Needs review" : "All verified"} tone={pendingVerificationCount > 0 ? "warning" : "success"} to="/verifications" />
          <StatCard icon={Users} label="Countries" value={uniqueCountries} helper={avgYear ? `Avg. Year ${avgYear}` : "Year not available"} tone="default" to="/analytics" />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Work Queue"
        subtitle="Priority-ordered items that need action now."
        variant="priority"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/articles">View All Articles</Link>
          </Button>
        }
      >
        <ol className="space-y-2.5">
          {workQueue.map((item, index) => (
            <li
              key={item.article.id}
              className={cn(
                "relative flex flex-col gap-3 rounded-lg border bg-background/90 p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between",
                item.priority <= 1 ? "border-primary/30" : "border-border/70",
              )}
            >
              <div className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary/80" />
              <div className="min-w-0 pl-2 sm:pl-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Priority {index + 1}
                  </Badge>
                  <StatusBadge tone={item.tone}>{item.statusLabel}</StatusBadge>
                </div>
                <p className="text-sm font-semibold leading-5 text-foreground">
                  {getQueuePrimaryText(item.article)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{getQueueSecondaryText(item.article)}</p>
              </div>

              <Button asChild size="sm" variant={item.priority <= 1 ? "default" : "outline"} className="self-start sm:self-auto">
                <Link to={item.actionTo}>
                  {item.actionLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </li>
          ))}
        </ol>
      </DashboardSection>

      <DashboardSection
        title="Recent Activity"
        subtitle="Most recently updated records."
        variant="subtle"
        compact
      >
        <div className="grid gap-2 lg:grid-cols-2">
          {recentActivity.map((article) => (
            <Link
              key={article.id}
              to={`/articles/${article.id}`}
              className="rounded-lg border border-border/70 bg-background/80 p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-5 text-foreground">{article.title || article.first_author || article.author || "Untitled"}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatActivityDate(article.created_at)}
                  </p>
                </div>
                {article.is_draft ? <StatusBadge tone="warning">Draft</StatusBadge> : <StatusBadge tone="success">Saved</StatusBadge>}
              </div>
            </Link>
          ))}
        </div>
      </DashboardSection>
    </div>
  );
};

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  helper: string;
  tone: "default" | "warning" | "success";
  to?: string;
}) {
  const iconTone = tone === "warning"
    ? "bg-warning/20 text-warning-foreground"
    : tone === "success"
      ? "bg-success/15 text-success"
      : "bg-primary/10 text-primary";
  if (to) {
    return (
      <Card className="h-full border-border/80 transition-colors hover:border-primary/40 hover:bg-primary/5">
        <Link to={to} className="block">
          <CardContent className="flex items-center gap-4 py-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconTone}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-none text-foreground">{value}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm text-muted-foreground/90">{helper}</p>
            </div>
          </CardContent>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="h-full border-border/80">
      <CardContent className="flex items-center gap-4 py-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none text-foreground">{value}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground/90">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ tone, children }: { tone: "warning" | "success"; children: string }) {
  const className = tone === "warning"
    ? "border-warning/40 bg-warning/20 text-warning-foreground"
    : "border-success/40 bg-success/15 text-success";

  return (
    <Badge variant="outline" className={className}>
      {children}
    </Badge>
  );
}

export default Dashboard;
