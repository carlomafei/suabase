import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface BrandingSettings {
  platform_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  footer_text: string;
  hide_platform_branding: boolean;
  custom_domain: string;
  theme_mode: "dark" | "light";
}

const BRANDING_CACHE_KEY = "taqt_branding_cache";

function hslStringToValues(hsl: string): string | null {
  const match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/) || hsl.match(/(\d+),?\s*(\d+)%,?\s*(\d+)%/);
  if (match) return `${match[1]} ${match[2]}% ${match[3]}%`;
  return null;
}

function applyBrandingToRoot(branding: BrandingSettings) {
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

  if (branding.theme_mode === "light") {
    root.classList.add("light");
  } else {
    root.classList.remove("light");
  }
}

function cacheBranding(branding: BrandingSettings) {
  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(branding));
  } catch {}
}

function getCachedBranding(): BrandingSettings {
  try {
    const cached = localStorage.getItem(BRANDING_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return {
    platform_name: "Taqt",
    logo_url: "",
    primary_color: "152 76% 46%",
    secondary_color: "220 16% 12%",
    footer_text: "",
    hide_platform_branding: false,
    custom_domain: "",
    theme_mode: "dark",
  };
}

// Read cached branding and apply immediately (before any React render)
const defaultBranding: BrandingSettings = getCachedBranding();
const hasCachedBranding = (() => {
  try { return !!localStorage.getItem(BRANDING_CACHE_KEY); } catch { return false; }
})();
// Only apply theme from cache if we actually have cached data.
// For new users with no cache, we wait for DB data to avoid dark→light flash.
if (hasCachedBranding) {
  applyBrandingToRoot(defaultBranding);
}

function parseBrandingFromData(data: any): BrandingSettings {
  const settings = (data.settings as Record<string, any>) || {};
  return {
    platform_name: settings.platform_name || data.name || defaultBranding.platform_name,
    logo_url: settings.logo_url || "",
    primary_color: settings.primary_color || defaultBranding.primary_color,
    secondary_color: settings.secondary_color || defaultBranding.secondary_color,
    footer_text: settings.footer_text || "",
    hide_platform_branding: settings.hide_platform_branding || false,
    custom_domain: settings.custom_domain || "",
    theme_mode: settings.theme_mode || "dark",
  };
}

async function fetchBrandingData(tenantId: string): Promise<BrandingSettings> {
  const { data } = await supabase
    .from("tenants")
    .select("settings, name")
    .eq("id", tenantId)
    .single();

  if (data) {
    const branding = parseBrandingFromData(data);
    cacheBranding(branding);
    return branding;
  }
  return defaultBranding;
}

export const useBranding = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const queryKey = ["branding", tenantId];

  const { data: branding = defaultBranding, isLoading: loading } = useQuery({
    queryKey,
    queryFn: () => fetchBrandingData(tenantId!),
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });

  // Apply CSS variables and theme mode when branding changes
  useEffect(() => {
    applyBrandingToRoot(branding);
  }, [branding.primary_color, branding.secondary_color, branding.theme_mode]);

  const mutation = useMutation({
    mutationFn: async (newBranding: BrandingSettings) => {
      if (!tenantId) throw new Error("No tenant");
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
            theme_mode: newBranding.theme_mode,
          },
        })
        .eq("id", tenantId);
      if (error) throw error;
      cacheBranding(newBranding);
      return newBranding;
    },
    onSuccess: (newBranding) => {
      queryClient.setQueryData(queryKey, newBranding);
    },
  });

  const saveBranding = async (newBranding: BrandingSettings): Promise<boolean> => {
    try {
      await mutation.mutateAsync(newBranding);
      return true;
    } catch {
      return false;
    }
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return { branding, loading, saveBranding, refetch };
};
