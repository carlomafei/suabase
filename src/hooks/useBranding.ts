import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";

export interface BrandingSettings {
  platform_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  footer_text: string;
  hide_platform_branding: boolean;
  custom_domain: string;
}

const defaultBranding: BrandingSettings = {
  platform_name: "Sua Base",
  logo_url: "",
  primary_color: "152 76% 46%",
  secondary_color: "220 16% 12%",
  footer_text: "",
  hide_platform_branding: false,
  custom_domain: "",
};

function hslStringToValues(hsl: string): string | null {
  // Accept "152 76% 46%" or "hsl(152, 76%, 46%)" formats
  const match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/) || hsl.match(/(\d+),?\s*(\d+)%,?\s*(\d+)%/);
  if (match) return `${match[1]} ${match[2]}% ${match[3]}%`;
  return null;
}

export const useBranding = () => {
  const { tenantId } = useTenant();
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("tenants")
      .select("settings, name")
      .eq("id", tenantId)
      .single();

    if (data) {
      const settings = (data.settings as Record<string, any>) || {};
      setBranding({
        platform_name: settings.platform_name || data.name || defaultBranding.platform_name,
        logo_url: settings.logo_url || "",
        primary_color: settings.primary_color || defaultBranding.primary_color,
        secondary_color: settings.secondary_color || defaultBranding.secondary_color,
        footer_text: settings.footer_text || "",
        hide_platform_branding: settings.hide_platform_branding || false,
        custom_domain: settings.custom_domain || "",
      });
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  // Apply CSS variables when branding changes
  useEffect(() => {
    const root = document.documentElement;
    const primary = hslStringToValues(branding.primary_color);
    const secondary = hslStringToValues(branding.secondary_color);

    if (primary) {
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--accent", primary);
      root.style.setProperty("--ring", primary);
      root.style.setProperty("--sidebar-primary", primary);
      root.style.setProperty("--sidebar-ring", primary);
      root.style.setProperty("--gradient-primary", `linear-gradient(135deg, hsl(${primary}), hsl(${primary} / 0.8))`);
      root.style.setProperty("--gradient-glow", `radial-gradient(ellipse at 50% 0%, hsl(${primary} / 0.15) 0%, transparent 60%)`);
    }
    if (secondary) {
      root.style.setProperty("--secondary", secondary);
      root.style.setProperty("--sidebar-accent", secondary);
    }

    return () => {
      // Reset to defaults on unmount
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-ring");
      root.style.removeProperty("--gradient-primary");
      root.style.removeProperty("--gradient-glow");
      root.style.removeProperty("--secondary");
      root.style.removeProperty("--sidebar-accent");
    };
  }, [branding.primary_color, branding.secondary_color]);

  const saveBranding = async (newBranding: BrandingSettings) => {
    if (!tenantId) return false;

    const { error } = await supabase
      .from("tenants")
      .update({
        settings: {
          platform_name: newBranding.platform_name,
          logo_url: newBranding.logo_url,
          primary_color: newBranding.primary_color,
          secondary_color: newBranding.secondary_color,
          footer_text: newBranding.footer_text,
          hide_platform_branding: newBranding.hide_platform_branding,
          custom_domain: newBranding.custom_domain,
        },
      })
      .eq("id", tenantId);

    if (!error) {
      setBranding(newBranding);
      return true;
    }
    return false;
  };

  return { branding, loading, saveBranding, refetch: fetchBranding };
};
