import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

const AuthQuerySync = () => {
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | null>(null);
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (loading) return;

    if (previousUserIdRef.current === null) {
      previousUserIdRef.current = userId;
      return;
    }

    if (previousUserIdRef.current !== userId) {
      queryClient.clear();
      previousUserIdRef.current = userId;
    }
  }, [loading, queryClient, userId]);

  return null;
};

export default AuthQuerySync;
