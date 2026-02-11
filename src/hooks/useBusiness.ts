import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useBusiness() {
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: business, isLoading: businessLoading } = useQuery({
    queryKey: ["business", profile?.business_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", profile!.business_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.business_id,
  });

  const { data: userRole } = useQuery({
    queryKey: ["userRole", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role as "owner" | "admin" | "agent" | null;
    },
    enabled: !!user,
  });

  return {
    profile,
    business,
    userRole,
    isLoading: profileLoading || businessLoading,
    businessId: profile?.business_id,
  };
}
