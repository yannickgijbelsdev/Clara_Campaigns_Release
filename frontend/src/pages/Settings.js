import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Mail, User, KeyRound } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  return (
    <AppLayout title="Security & Account" subtitle="Manage your account and two-factor authentication">
      <div className="max-w-2xl space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-display font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-rose-600" /> Account details
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500 w-24">Email</span>
              <span className="text-slate-800 font-medium" data-testid="account-email">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500 w-24">Name</span>
              <span className="text-slate-800 font-medium">{user?.name}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-display font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Two-factor authentication (MFA)
          </h2>
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-sm font-medium text-emerald-800">Authenticator app active</div>
                <div className="text-xs text-emerald-700">Your account is protected with a 6-digit code at every login.</div>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium">Enabled</span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            MFA is mandatory and was set up on your first login with Google / Microsoft Authenticator.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
