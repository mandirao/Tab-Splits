import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";
import logoPath from "@assets/icon-256_1775011577579.png";

type Mode = "login" | "register" | "forgot";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      return await apiRequest("/api/auth/login", "POST", data);
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      navigate("/");
    },
    onError: (err: any) => {
      toast({ title: "Sign in failed", description: err.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; name: string }) => {
      return await apiRequest("/api/auth/register", "POST", data);
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      navigate("/");
    },
    onError: (err: any) => {
      toast({ title: "Account creation failed", description: err.message, variant: "destructive" });
    },
  });

  const forgotMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      return await apiRequest("/api/auth/forgot-password", "POST", data);
    },
    onSuccess: (data: { resetUrl: string | null }) => {
      setResetUrl(data.resetUrl);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isBusy = loginMutation.isPending || registerMutation.isPending || forgotMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      loginMutation.mutate({ email: email.trim(), password });
    } else if (mode === "register") {
      if (!name.trim()) {
        toast({ title: "Name required", description: "Please enter your name.", variant: "destructive" });
        return;
      }
      registerMutation.mutate({ email: email.trim(), password, name: name.trim() });
    } else {
      forgotMutation.mutate({ email: email.trim() });
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword("");
    setResetUrl(null);
    if (next !== "forgot") setEmail("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo / Wordmark */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden mb-2">
            <img src={logoPath} alt="Tab Splits" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tab Splits</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : "Reset your password"}
          </p>
        </div>

        {/* Forgot password success state */}
        {mode === "forgot" && forgotMutation.isSuccess ? (
          <div className="space-y-4">
            {resetUrl ? (
              <div className="space-y-3">
                <p className="text-sm text-center text-muted-foreground">
                  Your reset link is ready. Tap it to set a new password.
                </p>
                <a
                  href={resetUrl}
                  className="block w-full text-center text-sm font-medium text-primary underline underline-offset-4 break-all"
                  data-testid="link-reset-url"
                >
                  Open reset link
                </a>
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                If an account exists for that email, a reset link has been generated. Check with your admin or try signing in.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => switchMode("login")}
              data-testid="button-back-to-login"
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <>
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "forgot" && (
                <p className="text-sm text-muted-foreground text-center -mb-1">
                  Enter your email and we'll generate a reset link for you.
                </p>
              )}

              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-name">Your name</Label>
                  <Input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Alex Chen"
                    disabled={isBusy}
                    data-testid="input-name"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isBusy}
                  data-testid="input-email"
                />
              </div>

              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-password">Password</Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="text-xs text-muted-foreground underline underline-offset-4"
                        data-testid="button-forgot-password"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="auth-password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
                    disabled={isBusy}
                    data-testid="input-password"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isBusy || !email || (mode !== "forgot" && !password)}
                data-testid="button-submit"
              >
                {isBusy
                  ? mode === "login" ? "Signing in…" : mode === "register" ? "Creating account…" : "Sending…"
                  : mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Send Reset Link"}
              </Button>
            </form>

            {/* Toggle / Back */}
            <div className="text-center text-sm text-muted-foreground">
              {mode === "forgot" ? (
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </button>
              ) : mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="font-medium text-foreground underline underline-offset-4"
                    data-testid="button-toggle-mode"
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="font-medium text-foreground underline underline-offset-4"
                    data-testid="button-toggle-mode"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
