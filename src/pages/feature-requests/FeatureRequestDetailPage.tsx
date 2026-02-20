import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "../../components/ui/Textarea";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { Alert } from "../../components/ui/Alert";
import { Label } from "../../components/ui/Label";
import {
  ArrowLeft,
  Save,
  MessageSquare,
  ThumbsUp,
  History,
  Archive,
  ArchiveRestore,
  Trash2,
  Calendar,
  User,
} from "lucide-react";
import {
  featureRequestUpdateSchema,
  featureRequestCommentSchema,
  type FeatureRequestUpdateInput,
  type FeatureRequestCommentInput,
} from "../../types/schemas";

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

export function FeatureRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    selectedRequest,
    comments,
    votes,
    adminLogs,
    isLoading,
    error,
    fetchRequestById,
    fetchComments,
    fetchVotes,
    fetchAdminLogs,
    updateRequest,
    updateStatus,
    updatePriority,
    addComment,
    archiveRequest,
    unarchiveRequest,
    deleteRequest,
  } = useFeatureRequestStore();

  const [isSaving, setIsSaving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FeatureRequestUpdateInput>({
    resolver: zodResolver(featureRequestUpdateSchema),
  });

  const {
    register: registerComment,
    handleSubmit: handleCommentSubmit,
    formState: { errors: commentErrors },
    reset: resetComment,
  } = useForm<FeatureRequestCommentInput>({
    resolver: zodResolver(featureRequestCommentSchema),
  });

  useEffect(() => {
    if (id) {
      fetchRequestById(id);
      fetchComments(id);
      fetchVotes(id);
      fetchAdminLogs(id);
    }
  }, [id, fetchRequestById, fetchComments, fetchVotes, fetchAdminLogs]);

  useEffect(() => {
    if (selectedRequest) {
      reset({
        title: selectedRequest.title,
        description: selectedRequest.description,
        status: selectedRequest.status,
        priority: selectedRequest.priority,
        category: selectedRequest.category || undefined,
        tags: selectedRequest.tags || undefined,
        admin_notes: selectedRequest.admin_notes || undefined,
        estimated_effort: selectedRequest.estimated_effort || undefined,
        target_release: selectedRequest.target_release || undefined,
      });
    }
  }, [selectedRequest, reset]);

  const onSubmit = async (data: FeatureRequestUpdateInput) => {
    if (!id) return;

    setIsSaving(true);
    const result = await updateRequest(id, data);
    setIsSaving(false);

    if (result.success) {
      setSuccessMessage("Request updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
      fetchRequestById(id);
      fetchAdminLogs(id);
    }
  };

  const onCommentSubmit = async (data: FeatureRequestCommentInput) => {
    if (!id) return;

    const result = await addComment(id, data);
    if (result.success) {
      resetComment();
      fetchComments(id);
      if (selectedRequest) {
        fetchRequestById(id);
      }
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;

    const result = await updateStatus(id, status as never);
    if (result.success) {
      setSuccessMessage("Status updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
      fetchAdminLogs(id);
    }
  };

  const handlePriorityChange = async (priority: string) => {
    if (!id) return;

    const result = await updatePriority(id, priority as never);
    if (result.success) {
      setSuccessMessage("Priority updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
      fetchAdminLogs(id);
    }
  };

  const handleArchive = async () => {
    if (!id || !archiveReason) return;

    const result = await archiveRequest(id, archiveReason);
    if (result.success) {
      setSuccessMessage("Request archived successfully!");
      setShowArchiveDialog(false);
      setArchiveReason("");
      fetchRequestById(id);
      fetchAdminLogs(id);
    }
  };

  const handleUnarchive = async () => {
    if (!id) return;

    const result = await unarchiveRequest(id);
    if (result.success) {
      setSuccessMessage("Request unarchived successfully!");
      fetchRequestById(id);
      fetchAdminLogs(id);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this feature request?"))
      return;

    const result = await deleteRequest(id);
    if (result.success) {
      navigate("/feature-requests");
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading && !selectedRequest) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!selectedRequest) {
    return <Alert variant="destructive">Feature request not found</Alert>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate("/feature-requests")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Feature Request Details</h1>
            <p className="text-muted-foreground mt-1">
              ID: {selectedRequest.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {selectedRequest.is_archived ? (
            <Button variant="outline" onClick={handleUnarchive}>
              <ArchiveRestore className="w-4 h-4 mr-2" />
              Unarchive
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(true)}
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>
          )}
          <Button variant="outline" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2 text-red-500" />
            Delete
          </Button>
        </div>
      </div>

      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Archive Dialog */}
      {showArchiveDialog && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle>Archive Feature Request</CardTitle>
            <CardDescription>
              Please provide a reason for archiving this request
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="Reason for archiving..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button onClick={handleArchive} disabled={!archiveReason}>
                Archive Request
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowArchiveDialog(false);
                  setArchiveReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Request Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {selectedRequest.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>
                      {selectedRequest.created_by_user?.firstName}{" "}
                      {selectedRequest.created_by_user?.lastName}
                    </span>
                    <span>•</span>
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(selectedRequest.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge className={statusColors[selectedRequest.status]}>
                    {selectedRequest.status.replace("_", " ").toUpperCase()}
                  </Badge>
                  <Badge className={priorityColors[selectedRequest.priority]}>
                    {selectedRequest.priority.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {selectedRequest.description}
                </p>
              </div>

              {selectedRequest.category && (
                <div>
                  <h3 className="font-semibold mb-2">Category</h3>
                  <Badge variant="outline">{selectedRequest.category}</Badge>
                </div>
              )}

              {selectedRequest.tags && selectedRequest.tags.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRequest.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-5 h-5 text-muted-foreground" />
                  <span className="text-lg font-semibold">
                    {selectedRequest.vote_count}
                  </span>
                  <span className="text-sm text-muted-foreground">votes</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                  <span className="text-lg font-semibold">
                    {selectedRequest.comment_count}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    comments
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle>Edit Request</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...register("title")} />
                  {errors.title && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register("description")}
                    rows={5}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.description.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      id="status"
                      {...register("status")}
                      options={[
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
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      id="priority"
                      {...register("priority")}
                      options={[
                        { value: "low", label: "Low" },
                        { value: "medium", label: "Medium" },
                        { value: "high", label: "High" },
                        { value: "critical", label: "Critical" },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" {...register("category")} />
                </div>

                <div>
                  <Label htmlFor="target_release">Target Release</Label>
                  <Input
                    id="target_release"
                    {...register("target_release")}
                    placeholder="e.g., v2.0"
                  />
                </div>

                <div>
                  <Label htmlFor="estimated_effort">
                    Estimated Effort (story points)
                  </Label>
                  <Input
                    id="estimated_effort"
                    type="number"
                    {...register("estimated_effort", { valueAsNumber: true })}
                  />
                </div>

                <div>
                  <Label htmlFor="admin_notes">Admin Notes</Label>
                  <Textarea
                    id="admin_notes"
                    {...register("admin_notes")}
                    rows={3}
                    placeholder="Internal notes for admins only..."
                  />
                </div>

                <Button type="submit" disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment Form */}
              <form
                onSubmit={handleCommentSubmit(onCommentSubmit)}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="comment">Add Admin Comment</Label>
                  <Textarea
                    id="comment"
                    {...registerComment("content")}
                    placeholder="Write your comment..."
                    rows={3}
                  />
                  {commentErrors.content && (
                    <p className="text-sm text-red-500 mt-1">
                      {commentErrors.content.message}
                    </p>
                  )}
                </div>
                <Button type="submit">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add Comment
                </Button>
              </form>

              {/* Comments List */}
              <div className="space-y-4 mt-6">
                {comments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No comments yet
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {(comment as never)["user"]?.firstName}{" "}
                            {(comment as never)["user"]?.lastName}
                          </span>
                          {comment.is_admin_comment && (
                            <Badge variant="outline" className="text-xs">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {comment.content}
                      </p>
                      {comment.is_edited && (
                        <p className="text-xs text-muted-foreground italic">
                          Edited
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Admin Logs */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Admin Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {adminLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No activity yet
                  </p>
                ) : (
                  adminLogs.map((log) => (
                    <div key={log.id} className="border-l-2 pl-4 pb-4">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          {log.action.replace("_", " ").toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold">
                        {(log as never)["admin"]?.firstName}{" "}
                        {(log as never)["admin"]?.lastName}
                      </p>
                      {log.notes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {log.notes}
                        </p>
                      )}
                      {log.old_value && log.new_value && (
                        <div className="text-xs mt-2 space-y-1">
                          <p className="text-muted-foreground">
                            Changed:{" "}
                            <span className="line-through">
                              {JSON.stringify(log.old_value)}
                            </span>{" "}
                            →{" "}
                            <span className="font-semibold">
                              {JSON.stringify(log.new_value)}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
