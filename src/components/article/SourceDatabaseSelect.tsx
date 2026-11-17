import { Link } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProtocolDatabases } from "@/hooks/useProtocolDatabases";

const NONE = "__none__";

type Props = {
  value?: string | null;
  onChange: (value: string) => void;
};

// Options come from the databases registered in the Protocol page; a value already saved on the
// article stays selectable even if it was removed from the protocol.
const SourceDatabaseSelect = ({ value, onChange }: Props) => {
  const { data: databases = [] } = useProtocolDatabases();
  const names = databases.map((database) => database.name);
  const options = value && !names.includes(value) ? [...names, value] : names;

  return (
    <div className="space-y-2">
      <Label>Source Database</Label>
      <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)}>
        <SelectTrigger><SelectValue placeholder="Select a database" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not specified</SelectItem>
          {options.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Databases are defined in the <Link to="/protocol" className="underline">Protocol</Link>.
      </p>
    </div>
  );
};

export default SourceDatabaseSelect;
