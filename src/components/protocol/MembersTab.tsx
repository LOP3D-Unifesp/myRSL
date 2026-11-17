import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthUserId } from "@/contexts/auth-user-id";
import { reviewsQueryKey, useCurrentReview } from "@/contexts/current-review";
import { addReviewMember, fetchReviewMembers, removeReviewMember, renameReview } from "@/lib/reviews";

const MembersTab = () => {
  const userId = useAuthUserId();
  const { review } = useCurrentReview();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState(review.name);
  const isOwner = review.role === "owner";
  const queryKey = ["review-members", review.id] as const;

  const { data: members = [] } = useQuery({ queryKey, queryFn: () => fetchReviewMembers(review.id) });

  const addMutation = useMutation({
    mutationFn: () => addReviewMember(review.id, email),
    onSuccess: () => {
      setEmail("");
      queryClient.invalidateQueries({ queryKey });
      toast.success("Member added.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add this member."),
  });

  const renameMutation = useMutation({
    mutationFn: () => renameReview(review.id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewsQueryKey(userId) });
      toast.success("Review renamed.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not rename the review."),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeReviewMember(review.id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Member removed.");
    },
    onError: () => toast.error("Could not remove this member."),
  });

  return (
    <div className="space-y-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && name.trim() !== review.name) renameMutation.mutate();
        }}
      >
        <div className="flex-1 space-y-2">
          <Label htmlFor="review-name">Review name</Label>
          <Input id="review-name" value={name} disabled={!isOwner} onChange={(e) => setName(e.target.value)} />
        </div>
        {isOwner ? (
          <Button type="submit" variant="outline" disabled={!name.trim() || name.trim() === review.name || renameMutation.isPending}>
            Rename
          </Button>
        ) : null}
      </form>

      <p className="text-sm text-muted-foreground">
        Everyone listed here can see and edit the articles and protocol of <strong>{review.name}</strong>. Only owners can add or remove people and delete articles.
      </p>

      {isOwner ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (email.trim()) addMutation.mutate();
          }}
        >
          <Input type="email" placeholder="E-mail of an existing account" aria-label="Member e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" disabled={!email.trim() || addMutation.isPending}>
            <UserPlus className="mr-1 h-4 w-4" />Add
          </Button>
        </form>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.user_id}>
              <TableCell className="font-medium">{member.full_name || "-"}</TableCell>
              <TableCell>{member.email}</TableCell>
              <TableCell><Badge variant={member.role === "owner" ? "default" : "secondary"}>{member.role}</Badge></TableCell>
              <TableCell>
                {isOwner && member.user_id !== userId ? (
                  <Button variant="ghost" size="icon" aria-label={`Remove ${member.email}`} onClick={() => removeMutation.mutate(member.user_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default MembersTab;
