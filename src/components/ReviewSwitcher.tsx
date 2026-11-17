import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentReview } from "@/contexts/current-review";

const ReviewSwitcher = () => {
  const { review, reviews, selectReview } = useCurrentReview();

  if (reviews.length <= 1) {
    return (
      <div className="px-4 pb-1 pt-3">
        <p className="text-xs uppercase tracking-wide text-sidebar-foreground/60">Review</p>
        <p className="truncate text-sm font-medium text-sidebar-foreground" title={review.name}>{review.name}</p>
        <Link to="/protocol?tab=team" className="text-xs text-sidebar-foreground/70 underline">Manage team & name</Link>
      </div>
    );
  }

  return (
    <div className="space-y-1 px-4 pb-1 pt-3">
      <p className="text-xs uppercase tracking-wide text-sidebar-foreground/60">Review</p>
      <Select value={review.id} onValueChange={selectReview}>
        <SelectTrigger className="h-9 border-sidebar-border/70 bg-transparent text-sidebar-foreground" aria-label="Select review">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {reviews.map((item) => (
            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link to="/protocol?tab=team" className="text-xs text-sidebar-foreground/70 underline">Manage team & name</Link>
    </div>
  );
};

export default ReviewSwitcher;
