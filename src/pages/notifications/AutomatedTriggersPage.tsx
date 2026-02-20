import { useState, useEffect } from "react";
import { Plus, Play, Settings, AlertCircle } from "lucide-react";
import { useTriggerStore } from "@/stores/triggerStore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Dialog } from "@/components/ui/Dialog";
import { TriggerForm } from "./TriggerForm";
import { ThrottleSettings } from "./ThrottleSettings";
import type { NotificationTrigger } from "@/types";

export function AutomatedTriggersPage() {
  const {
    triggers,
    executions,
    isLoading,
    error,
    fetchTriggers,
    fetchExecutions,
    toggleTrigger,
    deleteTrigger,
    processTriggers,
  } = useTriggerStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTrigger, setSelectedTrigger] =
    useState<NotificationTrigger | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchTriggers();
    fetchExecutions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Count successful sends per trigger
  const sendCountByTrigger = executions.reduce<Record<string, number>>(
    (acc, e) => {
      if ((e as any).success) {
        acc[(e as any).trigger_id] = (acc[(e as any).trigger_id] || 0) + 1;
      }
      return acc;
    },
    {}
  );

  const handleToggleTrigger = async (id: string, isActive: boolean) => {
    await toggleTrigger(id, isActive);
  };

  const handleDeleteTrigger = async (id: string) => {
    if (confirm("Are you sure you want to delete this trigger?")) {
      await deleteTrigger(id);
    }
  };

  const handleProcessTriggers = async () => {
    setProcessing(true);
    try {
      const result = await processTriggers();
      if (result.success) {
        alert("Triggers processed successfully!");
      } else {
        alert(`Error processing triggers: ${result.error}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const getTriggerTypeLabel = (type: string) => {
    const labels = {
      user_inactive: "User Inactive",
      signup_incomplete: "Signup Incomplete",
      video_abandoned: "Video Abandoned",
      practice_streak_broken: "Practice Streak Broken",
      milestone_reached: "Milestone Reached",
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTriggerDescription = (trigger: NotificationTrigger) => {
    const condition = trigger.condition_config as any;

    switch (trigger.trigger_type) {
      case "user_inactive":
        return `Inactive for ${condition.days_inactive} days`;
      case "signup_incomplete":
        return `Signup incomplete after ${condition.hours_since_signup} hours`;
      case "video_abandoned":
        return `Video abandoned at ${condition.watch_percentage_threshold}%`;
      case "practice_streak_broken":
        return `Practice streak broken after ${condition.days_since_break} days`;
      case "milestone_reached":
        return `${condition.milestone_type} milestone of ${condition.threshold_value}`;
      default:
        return trigger.description || "No description";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Automated Triggers</h1>
          <p className="text-muted-foreground mt-1">
            Set up automated notifications based on user behavior to improve
            retention
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowSettings(true)}
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Throttle Settings
          </Button>
          <Button
            onClick={handleProcessTriggers}
            disabled={processing}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            {processing ? "Processing..." : "Process Now"}
          </Button>
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Trigger
          </Button>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <div>
          <h4 className="font-medium">
            Coming Soon: Multi-Channel Notifications
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Email and SMS triggers are in development. Currently supporting push
            notifications only.
          </p>
        </div>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </Alert>
      )}

      {/* Triggers Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {triggers.map((trigger) => (
          <Card key={trigger.id} className="relative">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{trigger.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getTriggerDescription(trigger)}
                  </p>
                </div>
                <Switch
                  checked={trigger.is_active}
                  onCheckedChange={(checked) =>
                    handleToggleTrigger(trigger.id, checked)
                  }
                />
              </div>
              <div className="flex gap-2">
                <Badge variant={trigger.is_active ? "success" : "secondary"}>
                  {trigger.is_active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline">
                  {getTriggerTypeLabel(trigger.trigger_type)}
                </Badge>
                <Badge variant="outline">Priority {trigger.priority}</Badge>
                <Badge variant="outline" className="ml-auto">
                  {sendCountByTrigger[trigger.id] || 0} sent
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    Notification Preview
                  </h4>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="font-medium text-sm">{trigger.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {trigger.body}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTrigger(trigger)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTrigger(trigger.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {triggers.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
            <Play className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Triggers Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first automated trigger to start improving user
            retention.
          </p>
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Your First Trigger
          </Button>
        </div>
      )}

      {/* Create/Edit Form Dialog */}
      <Dialog
        open={showCreateForm || !!selectedTrigger}
        onClose={() => {
          setShowCreateForm(false);
          setSelectedTrigger(null);
        }}
      >
        <TriggerForm
          trigger={selectedTrigger}
          onSuccess={() => {
            setShowCreateForm(false);
            setSelectedTrigger(null);
            fetchTriggers();
          }}
          onCancel={() => {
            setShowCreateForm(false);
            setSelectedTrigger(null);
          }}
        />
      </Dialog>

      {/* Throttle Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)}>
        <ThrottleSettings onClose={() => setShowSettings(false)} />
      </Dialog>

    </div>
  );
}
