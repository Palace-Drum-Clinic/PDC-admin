import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Video,
  BookOpen,
  User,
  Play,
  Clock,
  Edit,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { useContentStore } from "@/stores";
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
import { formatDuration, formatDate } from "@/lib/utils";
import type { Video as VideoType } from "@/types/database";
import type { CourseWithVideos } from "@/stores/contentStore";

type ContentTab = "videos" | "courses" | "artists";

export function ContentListPage() {
  const [activeTab, setActiveTab] = useState<ContentTab>("videos");
  const {
    videos,
    courses,
    artists,
    isLoading,
    error,
    fetchVideos,
    fetchCourses,
    fetchArtists,
    deleteVideo,
    deleteCourse,
    deleteArtist,
    saveCourseOrder,
    toggleCourseVisibility,
  } = useContentStore();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(
    new Set()
  );

  // Local ordered list of courses for DnD — separate from store so we can discard
  const [orderedCourses, setOrderedCourses] = useState<CourseWithVideos[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchVideos();
    fetchCourses();
    fetchArtists();
  }, [fetchVideos, fetchCourses, fetchArtists]);

  // Sync local order when courses load/change (preserve order if dirty, but update hidden state)
  useEffect(() => {
    if (!isDirty) {
      setOrderedCourses(courses);
    } else {
      // Keep local order but sync hidden field changes from store
      setOrderedCourses((prev) =>
        prev.map((local) => {
          const updated = courses.find((c) => c.id === local.id);
          return updated ? { ...local, hidden: updated.hidden } : local;
        })
      );
    }
  }, [courses, isDirty]);

  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    setDeletingId(id);
    await deleteVideo(id);
    setDeletingId(null);
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    setDeletingId(id);
    await deleteCourse(id);
    setDeletingId(null);
  };

  const handleDeleteArtist = async (id: string) => {
    if (!confirm("Are you sure you want to delete this artist?")) return;
    setDeletingId(id);
    await deleteArtist(id);
    setDeletingId(null);
  };

  const toggleCourse = (id: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedCourses((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setIsDirty(true);
    setSaveError(null);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    setSaveError(null);
    const result = await saveCourseOrder(orderedCourses.map((c) => c.id));
    setIsSavingOrder(false);
    if (result.success) {
      setIsDirty(false);
    } else {
      setSaveError(result.error || "Failed to save order");
    }
  };

  const handleDiscardOrder = () => {
    setOrderedCourses(courses);
    setIsDirty(false);
    setSaveError(null);
  };

  const videoColumns: ColumnDef<VideoType>[] = [
    {
      accessorKey: "title",
      header: "Video",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-20 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {(row.original as any).thumbnailURL ? (
              <img
                src={(row.original as any).thumbnailURL}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Play className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="max-w-xs">
            <p className="font-medium truncate">{row.original.title}</p>
            <p className="text-sm text-muted-foreground truncate">
              {row.original.description}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "difficulty_level",
      header: "Difficulty",
      cell: ({ row }) => {
        const diff = row.original.difficulty_level;
        if (!diff) return <Badge variant="secondary">All</Badge>;
        const colors: Record<string, string> = {
          beginner: "bg-green-100 text-green-800",
          intermediate: "bg-yellow-100 text-yellow-800",
          advanced: "bg-red-100 text-red-800",
        };
        return (
          <Badge className={colors[diff] || ""}>
            {diff.charAt(0).toUpperCase() + diff.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => (
        <span className="flex items-center gap-1 text-sm">
          <Clock className="h-3 w-3" />
          {formatDuration((row.original as any).duration ?? 0)}
        </span>
      ),
    },
    {
      accessorKey: "is_free",
      header: "Access",
      cell: ({ row }) => (
        <Badge variant={row.original.is_free ? "secondary" : "default"}>
          {row.original.is_free ? "Free" : "Premium"}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Added",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate((row.original as any).createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/content/videos/${row.original.id}/edit`}>
              <Edit className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteVideo(row.original.id)}
            disabled={deletingId === row.original.id}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const videoTable = useReactTable({
    data: videos,
    columns: videoColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (isLoading && videos.length === 0 && courses.length === 0) {
    return <LoadingState message="Loading content..." />;
  }

  const tabs = [
    {
      id: "videos" as const,
      label: "Videos",
      count: videos.length,
      icon: Video,
    },
    {
      id: "courses" as const,
      label: "Courses",
      count: courses.length,
      icon: BookOpen,
    },
    {
      id: "artists" as const,
      label: "Artists",
      count: artists.length,
      icon: User,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="h-8 w-8" />
            Content Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage videos, courses, and artists for the PDC app.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "videos" && (
            <Button asChild>
              <Link to="/content/videos/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Video
              </Link>
            </Button>
          )}
          {activeTab === "courses" && (
            <>
              {isDirty && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleDiscardOrder}
                    disabled={isSavingOrder}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Discard
                  </Button>
                  <Button onClick={handleSaveOrder} disabled={isSavingOrder}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSavingOrder ? "Saving..." : "Save Order"}
                  </Button>
                </>
              )}
              <Button variant="outline" asChild>
                <Link to="/content/courses/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Course
                </Link>
              </Button>
              <Button asChild>
                <Link to="/content/courses/upload">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Course
                </Link>
              </Button>
            </>
          )}
          {activeTab === "artists" && (
            <Button asChild>
              <Link to="/content/artists/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Artist
              </Link>
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {saveError && <Alert variant="destructive">{saveError}</Alert>}

      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <Badge variant="secondary" className="ml-1">
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Videos Tab */}
      {activeTab === "videos" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Videos</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search videos..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-9 max-w-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full">
                <thead className="bg-muted/50">
                  {videoTable.getHeaderGroups().map((headerGroup) => (
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
                                header.getContext()
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {videoTable.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={videoColumns.length}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No videos found.
                      </td>
                    </tr>
                  ) : (
                    videoTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-t hover:bg-muted/50">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {videoTable.getState().pagination.pageIndex + 1} of{" "}
                {videoTable.getPageCount() || 1}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => videoTable.previousPage()}
                  disabled={!videoTable.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => videoTable.nextPage()}
                  disabled={!videoTable.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Courses Tab */}
      {activeTab === "courses" && (
        <div className="space-y-2">
          {isDirty && (
            <p className="text-sm text-muted-foreground">
              Drag courses to reorder, then save.
            </p>
          )}
          {orderedCourses.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No courses found. Create your first course!</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedCourses.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {orderedCourses.map((course) => (
                  <SortableCourseCard
                    key={course.id}
                    course={course}
                    expanded={expandedCourses.has(course.id)}
                    onToggle={() => toggleCourse(course.id)}
                    onDelete={() => handleDeleteCourse(course.id)}
                    isDeleting={deletingId === course.id}
                    onToggleVisibility={(hidden) =>
                      toggleCourseVisibility(course.id, hidden)
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* Artists Tab */}
      {activeTab === "artists" && (
        <Card>
          <CardContent className="pt-6">
            {artists.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No artists found. Add your first artist!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {artists.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {(a as any).profileImageURL || a.profile_image_url ? (
                            <img
                              src={
                                (a as any).profileImageURL ||
                                a.profile_image_url
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{a.name}</h3>
                          {(a as any).country && (
                            <p className="text-sm text-muted-foreground truncate">
                              {(a as any).country}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/content/artists/${a.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteArtist(a.id)}
                            disabled={deletingId === a.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface SortableCourseCardProps {
  course: CourseWithVideos;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onToggleVisibility: (hidden: boolean) => void;
}

function SortableCourseCard(props: SortableCourseCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.course.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CourseCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

interface CourseCardProps {
  course: CourseWithVideos;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onToggleVisibility: (hidden: boolean) => void;
  dragHandleProps?: Record<string, unknown>;
}

function CourseCard({
  course,
  expanded,
  onToggle,
  onDelete,
  isDeleting,
  onToggleVisibility,
  dragHandleProps,
}: CourseCardProps) {
  const sortedVideos = [...(course.CourseContent || [])].sort(
    (a, b) => a.order - b.order
  );

  return (
    <Card className={`select-none ${course.hidden ? "opacity-60" : ""}`}>
      <CardContent className="pt-4 pb-0">
        {/* Course header */}
        <div className="flex items-center gap-2 pb-4">
          {/* Drag handle */}
          <button
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground touch-none flex-shrink-0"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <button
            onClick={onToggle}
            className="flex items-center gap-2 flex-1 text-left min-w-0"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold truncate">{course.name}</p>
                {course.hidden && (
                  <Badge variant="secondary" className="text-xs">
                    Hidden
                  </Badge>
                )}
              </div>
              {course.description && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {course.description}
                </p>
              )}
            </div>
          </button>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary">
              {sortedVideos.length}{" "}
              {sortedVideos.length === 1 ? "video" : "videos"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleVisibility(!course.hidden)}
              title={course.hidden ? "Show in app" : "Hide from app"}
            >
              {course.hidden ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/content/courses/${course.id}/edit`}>
                <Edit className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Video list */}
        {expanded && sortedVideos.length > 0 && (
          <div className="border-t divide-y">
            {sortedVideos.map((cc, idx) => {
              const video = cc.Video;
              if (!video) return null;
              return (
                <div
                  key={cc.videoID}
                  className="flex items-center gap-3 py-3 px-2"
                >
                  <span className="text-sm text-muted-foreground w-6 text-right flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="h-9 w-16 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {video.thumbnailURL ? (
                      <img
                        src={video.thumbnailURL}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Play className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{video.title}</p>
                    {video.difficulty_level && (
                      <p className="text-xs text-muted-foreground capitalize">
                        {video.difficulty_level}
                      </p>
                    )}
                  </div>
                  {video.duration > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatDuration(video.duration)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {expanded && sortedVideos.length === 0 && (
          <div className="border-t py-4 text-center text-sm text-muted-foreground">
            No videos in this course yet.
          </div>
        )}
        {expanded && <div className="pb-2" />}
      </CardContent>
    </Card>
  );
}
