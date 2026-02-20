import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFeatureRequestStore } from "../../stores";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { Alert } from "../../components/ui/Alert";
import {
  MessageSquare,
  ThumbsUp,
  Plus,
  Search,
  Filter,
  Archive,
  Calendar,
} from "lucide-react";
import type { FeatureRequestFilter } from "../../types/schemas";

const statusColors = {
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-purple-100 text-purple-800",
  accepted: "bg-green-100 text-green-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  testing: "bg-orange-100 text-orange-800",
  completed: "bg-teal-100 text-teal-800",
  released: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  duplicate: "bg-gray-100 text-gray-800",
};

const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export function FeatureRequestsListPage() {
  const navigate = useNavigate();
  const { requests, isLoading, error, fetchRequests, filters, setFilters } =
    useFeatureRequestStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, filters]);

  const handleApplyFilters = () => {
    const newFilters: FeatureRequestFilter = {
      search: searchTerm || undefined,
      status: statusFilter.length > 0 ? (statusFilter as never) : undefined,
      priority:
        priorityFilter.length > 0 ? (priorityFilter as never) : undefined,
      is_archived: showArchived ? true : false,
    };
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter([]);
    setPriorityFilter([]);
    setShowArchived(false);
    setFilters({});
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feature Requests</h1>
          <p className="text-muted-foreground mt-1">
            Manage user feature requests and feedback
          </p>
        </div>
        <Button onClick={() => navigate("/feature-requests/new")}>
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search title or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select
                value={statusFilter[0] || ""}
                onChange={(e) =>
                  setStatusFilter(e.target.value ? [e.target.value] : [])
                }
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "submitted", label: "Submitted" },
                  { value: "under_review", label: "Under Review" },
                  { value: "accepted", label: "Accepted" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "testing", label: "Testing" },
                  { value: "completed", label: "Completed" },
                  { value: "released", label: "Released" },
                  { value: "rejected", label: "Rejected" },
                  { value: "duplicate", label: "Duplicate" },
                ]}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Priority</label>
              <Select
                value={priorityFilter[0] || ""}
                onChange={(e) =>
                  setPriorityFilter(e.target.value ? [e.target.value] : [])
                }
                options={[
                  { value: "", label: "All Priorities" },
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                  { value: "critical", label: "Critical" },
                ]}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Archived</label>
              <Select
                value={showArchived ? "true" : "false"}
                onChange={(e) => setShowArchived(e.target.value === "true")}
                options={[
                  { value: "false", label: "Active Only" },
                  { value: "true", label: "Archived Only" },
                ]}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApplyFilters}>Apply Filters</Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {requests.filter((r) => !r.is_archived).length}
            </div>
            <div className="text-sm text-muted-foreground">Active Requests</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {
                requests.filter(
                  (r) =>
                    r.status === "submitted" || r.status === "under_review",
                ).length
              }
            </div>
            <div className="text-sm text-muted-foreground">Pending Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {
                requests.filter(
                  (r) => r.status === "in_progress" || r.status === "testing",
                ).length
              }
            </div>
            <div className="text-sm text-muted-foreground">In Development</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {requests.filter((r) => r.status === "completed").length}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No feature requests found. Try adjusting your filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card
              key={request.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/feature-requests/${request.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{request.title}</CardTitle>
                      {request.is_archived && (
                        <Badge variant="outline" className="gap-1">
                          <Archive className="w-3 h-3" />
                          Archived
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {request.description}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge className={statusColors[request.status]}>
                      {request.status.replace("_", " ").toUpperCase()}
                    </Badge>
                    <Badge className={priorityColors[request.priority]}>
                      {request.priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-4 h-4" />
                      <span>{request.vote_count} votes</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>{request.comment_count} comments</span>
                    </div>
                    {request.category && (
                      <Badge variant="outline">{request.category}</Badge>
                    )}
                    {request.tags && request.tags.length > 0 && (
                      <div className="flex gap-1">
                        {request.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {request.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{request.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(request.created_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
