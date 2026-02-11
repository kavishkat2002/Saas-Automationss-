import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";

export default function AIInsights() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">AI Insights</h1>
        <p className="text-muted-foreground mt-1">AI-powered analytics and demand predictions</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
              <Brain className="h-5 w-5 text-accent-foreground" />
            </div>
            <CardTitle className="font-display text-base">Demand Prediction</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">AI-based demand forecasting will activate once you have order history data.</p>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-accent-foreground" />
            </div>
            <CardTitle className="font-display text-base">Sales Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Product upsell and cross-sell suggestions powered by customer purchase patterns.</p>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-accent-foreground" />
            </div>
            <CardTitle className="font-display text-base">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Intelligent stock alerts based on predicted demand and current inventory levels.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="font-display">Daily Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">AI-generated natural language summaries will appear here once you have enough data to analyze.</p>
        </CardContent>
      </Card>
    </div>
  );
}
