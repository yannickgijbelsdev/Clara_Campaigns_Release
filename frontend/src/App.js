import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { CheckCircle2, XCircle, Info, Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import TopLoadingBar from "@/components/TopLoadingBar";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import Builder from "@/pages/Builder";
import Contacts from "@/pages/Contacts";
import Integrations from "@/pages/Integrations";
import Settings from "@/pages/Settings";
import Analytics from "@/pages/Analytics";
import Admin from "@/pages/Admin";
import ResetPassword from "@/pages/ResetPassword";

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready || user === null) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="min-h-screen flex items-center justify-center text-slate-400">Laden…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <TopLoadingBar />
          <Toaster
            position="top-right"
            gap={10}
            toastOptions={{ duration: 3500, className: "clara-toast" }}
            icons={{
              success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
              error: <XCircle className="h-5 w-5 text-rose-500" />,
              info: <Info className="h-5 w-5 text-indigo-500" />,
              loading: <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />,
            }}
          />
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/campaigns" element={<Protected><Campaigns /></Protected>} />
            <Route path="/campaigns/new" element={<Protected><Builder /></Protected>} />
            <Route path="/campaigns/:id" element={<Protected><Builder /></Protected>} />
            <Route path="/campaigns/:id/analytics" element={<Protected><Analytics /></Protected>} />
            <Route path="/contacts" element={<Protected><Contacts /></Protected>} />
            <Route path="/integrations" element={<Protected><Integrations /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="/admin" element={<Protected><Admin /></Protected>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
