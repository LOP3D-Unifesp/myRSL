import { useQuery } from "@tanstack/react-query";
import { protocolKeys } from "@/lib/article-query-keys";
import { fetchProtocolDatabases } from "@/lib/protocol";
import { useAuthUserId } from "@/contexts/auth-user-id";

export function useProtocolDatabases() {
  const userId = useAuthUserId();
  return useQuery({
    queryKey: protocolKeys.databases(userId),
    queryFn: fetchProtocolDatabases,
    enabled: Boolean(userId),
  });
}
