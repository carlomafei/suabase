import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    const check = async () => {
      const { data } = await supabase.rpc("is_super_admin", {
        _user_id: session.user.id,
      });
      setIsSuperAdmin(!!data);
    };
    check();
  }, [session?.user]);

  if (loading || (session && isSuperAdmin === null)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || !isSuperAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
