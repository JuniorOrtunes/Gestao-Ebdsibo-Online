import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Subscribes to Supabase Realtime changes and invalidates TanStack Query cache automatically. */
export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("realtime-ebd-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["students"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        void queryClient.invalidateQueries({ queryKey: ["class-presence"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["classes"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teachers" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["teachers"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "attendances" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chamada"] });
        void queryClient.invalidateQueries({ queryKey: ["session"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        void queryClient.invalidateQueries({ queryKey: ["class-presence"] });
        void queryClient.invalidateQueries({ queryKey: ["weekly-trend"] });
        void queryClient.invalidateQueries({ queryKey: ["monthly-by-class"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teacher_attendances" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chamada"] });
        void queryClient.invalidateQueries({ queryKey: ["session"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        void queryClient.invalidateQueries({ queryKey: ["weekly-trend"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chamada"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
