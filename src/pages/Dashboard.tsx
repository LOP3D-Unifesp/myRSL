import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchArticleSummaries } from "@/lib/articles";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Beaker, TrendingUp, RefreshCw, PlusCircle, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Dashboard = () => {
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
        toast.info("No eligible articles found for DOI sync.");
        return;
      }

      toast.info(`Syncing DOIs for up to ${eligibleIds.length} article(s)...`);
      const { data, error } = await supabase.functions.invoke("sync-dois", {
        body: { articleIds: eligibleIds },
      });
      if (error) throw error;

      const updated = typeof data?.updated === "number" ? data.updated : 0;
      const failed = typeof data?.failed === "number" ? data.failed : 0;
      const skipped = typeof data?.skipped === "number" ? data.skipped : 0;

      const summary = [`${updated} updated`];
      if (failed > 0) summary.push(`${failed} failed`);
      if (skipped > 0) summary.push(`${skipped} skipped`);
      toast.success(`DOI sync complete: ${summary.join(", ")}`);

      queryClient.invalidateQueries({ queryKey: ["articles"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "DOI sync failed";
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
            {syncing ? "Syncing..." : "Sync Missing DOIs"}
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
