import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Bell,
  Clock,
  Check,
  XCircle,
  Trash2,
  Edit,
  Send,
  Zap,
  BarChart3,
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useNotificationStore } from "@/stores";
import {
  Button,
  Badge,
  Input,
  LoadingState,
  Alert,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { ScheduledNotification } from "@/types/database";

const statusConfig = {
  pending: { label: "Pending", variant: "secondary" as const, icon: Clock },
  sent: { label: "Sent", variant: "success" as const, icon: Check },
  failed: { label: "Failed", variant: "destructive" as const, icon: XCircle },
  cancelled: { label: "Cancelled", variant: "outline" as const, icon: XCircle },
};

export function NotificationsListPage() {
  const {
    notifications,
    isLoading,
    error,
    fetchNotifications,
    deleteNotification,
    processScheduledNotifications,
  } = useNotificationStore();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "scheduled_for", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;
    setDeletingId(id);
    await deleteNotification(id);
    setDeletingId(null);
  };

  const columns: ColumnDef<ScheduledNotification>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="max-w-xs">
          <p className="font-medium truncate">{row.original.title}</p>
          <p className="text-sm text-muted-foreground truncate">
            {row.original.body}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const config = statusConfig[status];
        const Icon = config.icon;
        return (
          <Badge variant={config.variant} className="gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "scheduled_for",
      header: "Scheduled For",
      cell: ({ row }) => formatDateTime(row.original.scheduled_for),
    },
    {
      accessorKey: "target_audience",
      header: "Audience",
      cell: ({ row }) => {
        const audience = row.original.target_audience;

        // Handle different audience formats
        let audienceData;
        try {
          audienceData =
            typeof audience === "string" ? JSON.parse(audience) : audience;
        } catch {
          audienceData = { type: "all" };
        }

        switch (audienceData?.type) {
          case "all":
            return <Badge variant="secondary">All Users</Badge>;
          case "admins":
            return <Badge variant="destructive">Admins Only</Badge>;
          case "users":
            return <Badge variant="outline">Specific Users</Badge>;
          case "segment":
            return <Badge variant="outline">Custom Segment</Badge>;
          default:
            return <Badge variant="secondary">All Users</Badge>;
        }
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.status === "sent" && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/notifications/${row.original.id}`}>
                <BarChart3 className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {row.original.status === "pending" && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/notifications/${row.original.id}/edit`}>
                <Edit className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row.original.id)}
            disabled={deletingId === row.original.id}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: notifications,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (isLoading && notifications.length === 0) {
    return <LoadingState message="Loading notifications..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Push Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Schedule and manage push notifications for your users.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => processScheduledNotifications()}
            disabled={isLoading}
          >
            <Send className="h-4 w-4 mr-2" />
            Process Now
          </Button>
          <Button asChild>
            <Link to="/notifications/new">
              <Plus className="h-4 w-4 mr-2" />
              Schedule Notification
            </Link>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-8">
          <Link
            to="/notifications"
            className="border-b-2 border-primary py-2 px-1 text-sm font-medium text-primary"
          >
            <Bell className="inline w-4 h-4 mr-2" />
            Scheduled Notifications
          </Link>
          <Link
            to="/notifications/triggers"
            className="border-b-2 border-transparent py-2 px-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
          >
            <Zap className="inline w-4 h-4 mr-2" />
            Automated Triggers
          </Link>
        </nav>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {notifications.filter((n) => n.status === "pending").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {notifications.filter((n) => n.status === "sent").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {notifications.filter((n) => n.status === "failed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Notifications</CardTitle>
            <Input
              placeholder="Search notifications..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No notifications found. Create your first one!
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-muted/50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
