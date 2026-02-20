import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useTriggerStore } from "@/stores/triggerStore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { X } from "lucide-react";

interface TriggerAnalyticsProps {
  onClose: () => void;
}

export function TriggerAnalytics({ onClose }: TriggerAnalyticsProps) {
  const { triggers, fetchTriggers, getTriggerPerformance } = useTriggerStore();
  const [selectedTriggerId, setSelectedTriggerId] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState(30);
  const [performance, setPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTriggers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (triggers.length > 0 && !selectedTriggerId) {
      setSelectedTriggerId(triggers[0].id);
    }
  }, [triggers, selectedTriggerId]);

  useEffect(() => {
    if (selectedTriggerId) {
      loadPerformance();
    }
  }, [selectedTriggerId, selectedDays]);

  const loadPerformance = async () => {
    if (!selectedTriggerId) return;

    setLoading(true);
    try {
      const result = await getTriggerPerformance(
        selectedTriggerId,
        selectedDays
      );
      if (result.success) {
        setPerformance(result.data);
      }
    } catch (error) {
      console.error("Error loading performance:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedTrigger = triggers.find((t) => t.id === selectedTriggerId);

  // Mock overall analytics data for the overview
  const overallStats = {
    totalTriggers: triggers.length,
    activeTriggers: triggers.filter((t) => t.is_active).length,
    totalExecutions: performance?.executions || 0,
    avgOpenRate: performance?.open_rate || 0,
  };

  const triggerTypeDistribution = triggers.reduce((acc: any[], trigger) => {
    const existing = acc.find((item) => item.type === trigger.trigger_type);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({
        type: trigger.trigger_type
          .replace("_", " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        count: 1,
      });
    }
    return acc;
  }, []);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  const performanceMetrics = performance
    ? [
        { name: "Executions", value: performance.executions, color: "#0088FE" },
        {
          name: "Deliveries",
          value: performance.successful_deliveries,
          color: "#00C49F",
        },
        {
          name: "Opens",
          value: Math.round(
            (performance.successful_deliveries * performance.open_rate) / 100
          ),
          color: "#FFBB28",
        },
        {
          name: "Clicks",
          value: Math.round(
            (performance.successful_deliveries * performance.click_rate) / 100
          ),
          color: "#FF8042",
        },
      ]
    : [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Trigger Analytics</h2>
          <p className="text-muted-foreground">
            Performance insights for automated triggers
          </p>
        </div>
        <Button variant="outline" onClick={onClose} className="gap-2">
          <X className="w-4 h-4" />
          Close
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {overallStats.totalTriggers}
            </div>
            <p className="text-xs text-muted-foreground">Total Triggers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {overallStats.activeTriggers}
            </div>
            <p className="text-xs text-muted-foreground">Active Triggers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {overallStats.totalExecutions}
            </div>
            <p className="text-xs text-muted-foreground">Total Executions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {overallStats.avgOpenRate}%
            </div>
            <p className="text-xs text-muted-foreground">Avg Open Rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Trigger Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Trigger Types</CardTitle>
          </CardHeader>
          <CardContent>
            {triggerTypeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={triggerTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {triggerTypeDistribution.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No trigger data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {performanceMetrics.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No performance data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Individual Trigger Performance */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Individual Trigger Performance</CardTitle>
            <div className="flex gap-4">
              <Select
                value={selectedTriggerId}
                onChange={(e) => setSelectedTriggerId(e.target.value)}
                options={triggers.map((trigger) => ({
                  value: trigger.id,
                  label: trigger.name,
                }))}
                placeholder="Select trigger"
                className="w-48"
              />
              <Select
                value={selectedDays.toString()}
                onChange={(value) => setSelectedDays(Number(value))}
                options={[
                  { value: "7", label: "Last 7 days" },
                  { value: "30", label: "Last 30 days" },
                  { value: "90", label: "Last 90 days" },
                ]}
                className="w-32"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner />
            </div>
          ) : selectedTrigger && performance ? (
            <div className="space-y-4">
              {/* Trigger Info */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{selectedTrigger.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedTrigger.trigger_type
                      .replace("_", " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                </div>
                <Badge
                  variant={selectedTrigger.is_active ? "success" : "secondary"}
                >
                  {selectedTrigger.is_active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">
                  Priority {selectedTrigger.priority}
                </Badge>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {performance.executions}
                  </div>
                  <p className="text-xs text-muted-foreground">Executions</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {performance.successful_deliveries}
                  </div>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {performance.open_rate}%
                  </div>
                  <p className="text-xs text-muted-foreground">Open Rate</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {performance.click_rate}%
                  </div>
                  <p className="text-xs text-muted-foreground">Click Rate</p>
                </div>
              </div>

              {/* Notification Preview */}
              <div>
                <h5 className="font-medium mb-2">Notification Preview</h5>
                <div className="bg-muted p-4 rounded-lg border-l-4 border-blue-500">
                  <p className="font-medium text-sm">{selectedTrigger.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTrigger.body}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              {triggers.length === 0
                ? "No triggers available"
                : "Select a trigger to view performance"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
