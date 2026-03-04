import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Plug, Users, Sliders, CreditCard } from "lucide-react";
import BrandingSettings from "./BrandingSettings";
import PlanSettings from "./PlanSettings";
import IntegrationSettings from "./IntegrationSettings";

const AppSettings = () => (
  <div>
    

    <Tabs defaultValue="plan" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="plan" className="gap-2">
          <CreditCard className="h-4 w-4" />
          Plano
        </TabsTrigger>
        <TabsTrigger value="branding" className="gap-2">
          <Palette className="h-4 w-4" />
          Branding
        </TabsTrigger>
        <TabsTrigger value="integrations" className="gap-2">
          <Plug className="h-4 w-4" />
          Integrações
        </TabsTrigger>
        <TabsTrigger value="team" className="gap-2">
          <Users className="h-4 w-4" />
          Equipe
        </TabsTrigger>
        <TabsTrigger value="preferences" className="gap-2">
          <Sliders className="h-4 w-4" />
          Preferências
        </TabsTrigger>
      </TabsList>

      <TabsContent value="plan">
        <PlanSettings />
      </TabsContent>
      <TabsContent value="branding">
        <BrandingSettings />
      </TabsContent>
      <TabsContent value="integrations">
        <IntegrationSettings />
      </TabsContent>
      <TabsContent value="team">
        <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
          <p className="text-muted-foreground">Em breve: gerenciamento de equipe e permissões.</p>
        </div>
      </TabsContent>
      <TabsContent value="preferences">
        <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
          <p className="text-muted-foreground">Em breve: notificações, idioma e preferências gerais.</p>
        </div>
      </TabsContent>
    </Tabs>
  </div>
);

export default AppSettings;
