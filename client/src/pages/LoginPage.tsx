import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Utensils } from "lucide-react";

type Mode = "login" | "register";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

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

  const isBusy = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      loginMutation.mutate({ email: email.trim(), password });
    } else {
      if (!name.trim()) {
        toast({ title: "Name required", description: "Please enter your name.", variant: "destructive" });
        return;
      }
      registerMutation.mutate({ email: email.trim(), password, name: name.trim() });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / Wordmark */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <Utensils className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tab Splits</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
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

          <Button
            type="submit"
            className="w-full"
            disabled={isBusy || !email || !password}
            data-testid="button-submit"
          >
            {isBusy
              ? mode === "login" ? "Signing in…" : "Creating account…"
              : mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {/* Toggle */}
        <div className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("register"); setPassword(""); }}
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
                onClick={() => { setMode("login"); setPassword(""); }}
                className="font-medium text-foreground underline underline-offset-4"
                data-testid="button-toggle-mode"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
