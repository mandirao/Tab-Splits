import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Users, Receipt, ScanLine, Share2, TrendingUp, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminStats {
  users: {
    total: number;
    newToday: number;
    newThisWeek: number;
  };
  receipts: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    withOcr: number;
    shared: number;
  };
  activeAdminsThisWeek: number;
  dailyTrend: Array<{ day: string; count: number }>;
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          {value}
        </div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const [, navigate] = useLocation();

  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30_000,
  });

  const maxCount = stats?.dailyTrend.length
    ? Math.max(...stats.dailyTrend.map((d) => d.count), 1)
    : 1;

  function formatDay(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats ? (
          <>
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Users
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  title="Total Users"
                  value={stats.users.total}
                  icon={Users}
                />
                <StatCard
                  title="Active This Week"
                  value={stats.activeAdminsThisWeek}
                  sub="users with receipts"
                  icon={UserCheck}
                />
                <StatCard
                  title="New Today"
                  value={stats.users.newToday}
                  icon={Users}
                />
                <StatCard
                  title="New This Week"
                  value={stats.users.newThisWeek}
                  icon={TrendingUp}
                />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Receipts
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  title="Today"
                  value={stats.receipts.today}
                  icon={Receipt}
                />
                <StatCard
                  title="This Week"
                  value={stats.receipts.thisWeek}
                  icon={Receipt}
                />
                <StatCard
                  title="This Month"
                  value={stats.receipts.thisMonth}
                  icon={Receipt}
                />
                <StatCard
                  title="All Time"
                  value={stats.receipts.total}
                  icon={Receipt}
                />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Feature Usage
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  title="OCR Scans"
                  value={stats.receipts.withOcr}
                  sub="receipts with scanned image"
                  icon={ScanLine}
                />
                <StatCard
                  title="Shared Tabs"
                  value={stats.receipts.shared}
                  sub="share links generated"
                  icon={Share2}
                />
              </div>
            </section>

            {stats.dailyTrend.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Receipts — Last 7 Days
                </h2>
                <Card>
                  <CardContent className="pt-4 pb-2">
                    <div className="flex items-end gap-2 h-28">
                      {stats.dailyTrend.map((d) => {
                        const pct = Math.max((d.count / maxCount) * 100, 4);
                        return (
                          <div key={d.day} className="flex flex-col items-center flex-1 gap-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              {d.count}
                            </span>
                            <div
                              className="w-full rounded-sm bg-primary/80"
                              style={{ height: `${pct}%` }}
                            />
                            <span className="text-[10px] text-muted-foreground text-center leading-tight">
                              {formatDay(d.day)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            <p className="text-xs text-muted-foreground text-center pb-4">
              Refreshes every 30 seconds
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-center py-12">Failed to load stats.</p>
        )}
      </div>
    </div>
  );
}
