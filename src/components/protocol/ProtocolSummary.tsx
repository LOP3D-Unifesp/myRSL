type Props = {
  databases: number;
  totalResults: number;
  inclusion: number;
  exclusion: number;
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/25 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value.toLocaleString()}</p>
    </div>
  );
}

const ProtocolSummary = ({ databases, totalResults, inclusion, exclusion }: Props) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <Metric label="Databases" value={databases} />
    <Metric label="Records identified" value={totalResults} />
    <Metric label="Inclusion criteria" value={inclusion} />
    <Metric label="Exclusion criteria" value={exclusion} />
  </div>
);

export default ProtocolSummary;
