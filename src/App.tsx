import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProtectedRoute, { AdminRoute } from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import AdminLayout from "./components/AdminLayout";
import Dashboard from "./pages/app/Dashboard";
import Contacts from "./pages/app/Contacts";
import Orders from "./pages/app/Orders";
import CRM from "./pages/app/CRM";
import Messages from "./pages/app/Messages";
import Automations from "./pages/app/Automations";
import Analytics from "./pages/app/Analytics";
import AppSettings from "./pages/app/AppSettings";
import BlingCallback from "./pages/app/BlingCallback";
import AdminMetrics from "./pages/admin/AdminMetrics";
import AdminTenants from "./pages/admin/AdminTenants";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminLogin from "./pages/admin/AdminLogin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="orders" element={<Orders />} />
            <Route path="crm" element={<CRM />} />
            <Route path="messages" element={<Messages />} />
            <Route path="automations" element={<Automations />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<AppSettings />} />
            <Route path="bling/callback" element={<BlingCallback />} />
          </Route>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminMetrics />} />
            <Route path="tenants" element={<AdminTenants />} />
            <Route path="plans" element={<AdminPlans />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="billing" element={<AdminBilling />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
