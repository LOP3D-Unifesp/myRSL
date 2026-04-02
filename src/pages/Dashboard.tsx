import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchArticleSummaries, syncCurrentUserDoiMetadata } from "@/lib/articles";
import { saveDoiConflictReviewState } from "@/lib/doi-conflict-review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Beaker, TrendingUp, RefreshCw, PlusCircle, type LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: articles = [] } = useQuery({
    queryKey: ["articles"],
    queryFn: fetchArticleSummaries,
  });

  const totalArticles = articles.length;
  const draftCount = articles.filter((a) => a.is_draft).length;
  const uniqueCountries = new Set(articles.map((a) => a.country).filter(Boolean)).size;
  const validYearRows = articles.filter((a) => a.year != null);
  const avgYear = validYearRows.length
    ? Math.round(validYearRows.reduce((sum, article) => sum + (article.year ?? 0), 0) / validYearRows.length)
    : 0;

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

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Systematic review overview</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleSyncDois} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync DOI Metadata"}
          </Button>
          <Button asChild>
            <Link to="/articles/new">
              <PlusCircle className="mr-2 h-4 w-4" /> New Article
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard icon={FileText} label="Total Articles" value={totalArticles} />
        <StatCard icon={Beaker} label="Drafts" value={draftCount} />
        <StatCard icon={Users} label="Countries" value={uniqueCountries} />
        <StatCard icon={TrendingUp} label="Avg. Year" value={avgYear || "-"} />
      </div>

      {articles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Recent Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {articles.slice(0, 5).map((a) => (
                <Link
                  key={a.id}
                  to={`/articles/${a.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {(a.first_author || a.author || "No author") + (a.year ? ` (${a.year})` : "")}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.prosthesis_name || a.study_id || "-"}</p>
                  </div>
                  {a.is_draft && (
                    <span className="text-xs text-muted-foreground border rounded px-2 py-0.5">Draft</span>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {articles.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground mb-2">No articles yet</p>
            <Button asChild variant="outline">
              <Link to="/articles/new">Get Started</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default Dashboard;
