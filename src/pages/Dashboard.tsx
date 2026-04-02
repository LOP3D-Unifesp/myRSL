import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchArticleSummaries, syncCurrentUserDoiMetadata, type ArticleListItem } from "@/lib/articles";
import { formatCompactAuthors } from "@/lib/article-authors";
import { saveDoiConflictReviewState } from "@/lib/doi-conflict-review";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, Beaker, TrendingUp, RefreshCw, PlusCircle, type LucideIcon, LayoutDashboard, ShieldCheck, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import PageState from "@/components/layout/PageState";
import DashboardSection from "@/components/layout/DashboardSection";

type QueueItem = {
  article: ArticleListItem;
  priority: number;
  actionLabel: "Continue" | "Review" | "Open";
  actionTo: string;
};

function isFullyVerified(article: ArticleListItem): boolean {
  return Boolean(article.verify_peer1 && article.verify_peer2 && article.verify_qa3 && article.verify_qa4);
}

function buildQueueItem(article: ArticleListItem): QueueItem {
  if (article.is_draft) {
    return { article, priority: 0, actionLabel: "Continue", actionTo: `/articles/${article.id}/edit` };
  }

  if (!isFullyVerified(article)) {
    return { article, priority: 1, actionLabel: "Review", actionTo: `/articles/${article.id}` };
  }

  return { article, priority: 2, actionLabel: "Open", actionTo: `/articles/${article.id}` };
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
  const uniqueCountries = new Set(articles.map((a) => a.country).filter(Boolean)).size;
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
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={FileText} label="Total Articles" value={totalArticles} helper="All records" tone="default" />
          <StatCard icon={Beaker} label="Drafts" value={draftCount} helper={draftCount > 0 ? "Need completion" : "No pending drafts"} tone={draftCount > 0 ? "warning" : "default"} />
          <StatCard icon={ShieldCheck} label="Pending Verification" value={pendingVerificationCount} helper={pendingVerificationCount > 0 ? "Needs review" : "All verified"} tone={pendingVerificationCount > 0 ? "warning" : "success"} />
          <StatCard icon={Users} label="Countries" value={uniqueCountries} helper={avgYear ? `Avg. Year ${avgYear}` : "Year not available"} tone="default" />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Work Queue"
        subtitle="Priority-ordered items that need action now."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/articles">View All Articles</Link>
          </Button>
        }
      >
        <div className="space-y-2">
          {workQueue.map((item) => (
            <article key={item.article.id} className="flex flex-col gap-3 rounded-lg border bg-background/80 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {formatCompactAuthors(item.article.author, item.article.first_author) + (item.article.year ? ` (${item.article.year})` : "")}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.article.prosthesis_name || item.article.study_id || item.article.title || "No details"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.article.is_draft ? <StatusBadge tone="warning">Draft</StatusBadge> : null}
                  {!item.article.is_draft && isFullyVerified(item.article) ? <StatusBadge tone="success">Verified</StatusBadge> : null}
                  {!item.article.is_draft && !isFullyVerified(item.article) ? <StatusBadge tone="warning">Pending</StatusBadge> : null}
                </div>
              </div>

              <Button asChild size="sm" className="self-start sm:self-auto">
                <Link to={item.actionTo}>
                  {item.actionLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Recent Activity"
        subtitle="Most recently updated records."
      >
        <div className="grid gap-2 lg:grid-cols-2">
          {recentActivity.map((article) => (
            <Link
              key={article.id}
              to={`/articles/${article.id}`}
              className="rounded-lg border bg-background/80 p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{article.title || article.first_author || article.author || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">{formatActivityDate(article.created_at)}</p>
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
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  helper: string;
  tone: "default" | "warning" | "success";
}) {
  const iconTone = tone === "warning" ? "bg-warning/20 text-warning-foreground" : tone === "success" ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary";

  return (
    <Card className="h-full border-border/80">
      <CardContent className="flex items-center gap-4 py-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none text-foreground">{value}</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground/90">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ tone, children }: { tone: "warning" | "success"; children: string }) {
  const className = tone === "warning"
    ? "border-warning/40 bg-warning/20 text-warning-foreground"
    : "border-accent/40 bg-accent/15 text-accent";

  return (
    <Badge variant="outline" className={className}>
      {children}
    </Badge>
  );
}

export default Dashboard;
