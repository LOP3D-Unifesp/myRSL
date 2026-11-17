import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DatabaseDialog from "@/components/protocol/DatabaseDialog";
import type { ProtocolDatabase, ProtocolDatabaseWriteInput } from "@/lib/protocol";

type Props = {
  databases: ProtocolDatabase[];
  onSave: (input: ProtocolDatabaseWriteInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const DatabasesTab = ({ databases, onSave, onDelete }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProtocolDatabase | null>(null);
  const [removing, setRemoving] = useState<ProtocolDatabase | null>(null);

  const openDialog = (database: ProtocolDatabase | null) => {
    setEditing(database);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Databases listed here are the options for the Source Database field of each article.</p>
        <Button onClick={() => openDialog(null)}><Plus className="mr-1 h-4 w-4" />Add database</Button>
      </div>

      {databases.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-10 text-center">
          <p className="font-medium">No databases yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add Scopus, IEEE, ACM, PubMed... with the search string used in each.</p>
          <Button className="mt-4" onClick={() => openDialog(null)}><Plus className="mr-1 h-4 w-4" />Add database</Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Database</TableHead>
              <TableHead>Search date</TableHead>
              <TableHead className="text-right">Results</TableHead>
              <TableHead>Search string</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {databases.map((database) => (
              <TableRow key={database.id}>
                <TableCell className="font-medium">{database.name}</TableCell>
                <TableCell>{database.searched_at ?? "-"}</TableCell>
                <TableCell className="text-right">{database.results_count?.toLocaleString() ?? "-"}</TableCell>
                <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground" title={database.search_string ?? undefined}>
                  {database.search_string || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${database.name}`} onClick={() => openDialog(database)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${database.name}`} onClick={() => setRemoving(database)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DatabaseDialog
        open={dialogOpen}
        database={editing}
        existingNames={databases.map((database) => database.name)}
        onOpenChange={setDialogOpen}
        onSubmit={onSave}
      />

      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It will no longer be offered as an option. Articles keep their saved database name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (removing) void onDelete(removing.id); setRemoving(null); }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DatabasesTab;
