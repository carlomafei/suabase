import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const BlingCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const tenantId = searchParams.get("state");

    if (!code || !tenantId) {
      setStatus("error");
      setErrorMsg("Parâmetros inválidos no callback.");
      return;
    }

    const exchangeCode = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("bling-oauth-callback", {
          body: { code, tenant_id: tenantId },
        });

        if (error || !data?.success) {
          setStatus("error");
          setErrorMsg(data?.error || error?.message || "Erro ao conectar ao Bling");
          return;
        }

        setStatus("success");
        setTimeout(() => navigate("/app/settings", { replace: true }), 2000);
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err.message || "Erro inesperado");
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Conectando ao Bling...</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <p className="text-sm font-medium">Bling conectado com sucesso!</p>
              <p className="text-xs text-muted-foreground">Redirecionando...</p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-10 w-10 text-destructive mx-auto" />
              <p className="text-sm font-medium">Erro ao conectar</p>
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
              <Button size="sm" onClick={() => navigate("/app/settings", { replace: true })}>
                Voltar para Configurações
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BlingCallback;
