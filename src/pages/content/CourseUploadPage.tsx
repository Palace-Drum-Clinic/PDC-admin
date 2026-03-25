import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  Film,
  ImageIcon,
  FileText,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadToS3 } from "@/lib/s3";
import { useContentStore } from "@/stores";
import {
  Button,
  Input,
  Textarea,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Alert,
  Switch,
  Badge,
} from "@/components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type DifficultyLevel = "beginner" | "intermediate" | "advanced";

interface VideoEntry {
  _id: string;
  title: string;
  description: string;
  artistId: string;
  difficultyLevel: DifficultyLevel;
  isFree: boolean;
  // Files
  videoFile: File | null;
  thumbnailFile: File | null;
  pdfFile: File | null;
  // Previews
  thumbnailPreview: string | null;
  // Upload progress (0–100)
  videoProgress: number;
  thumbnailProgress: number;
  pdfProgress: number;
}

type SaveStep =
  | { status: "idle" }
  | { status: "uploading"; label: string; videoIndex: number; total: number }
  | { status: "saving"; label: string }
  | { status: "done" }
  | { status: "error"; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newVideoEntry(): VideoEntry {
  return {
    _id: crypto.randomUUID(),
    title: "",
    description: "",
    artistId: "",
    difficultyLevel: "beginner",
    isFree: true,
    videoFile: null,
    thumbnailFile: null,
    pdfFile: null,
    thumbnailPreview: null,
    videoProgress: 0,
    thumbnailProgress: 0,
    pdfProgress: 0,
  };
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      resolve(Math.round(el.duration));
    };
    el.onerror = () => resolve(0);
    el.src = URL.createObjectURL(file);
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CourseUploadPage() {
  const navigate = useNavigate();
  const { artists, fetchArtists } = useContentStore();

  const [courseName, setCourseName] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseThumbnailFile, setCourseThumbnailFile] = useState<File | null>(null);
  const [courseThumbnailPreview, setCourseThumbnailPreview] = useState<string | null>(null);
  const [courseArtistId, setCourseArtistId] = useState("");
  const prevCourseArtistId = useRef("");
  const [videos, setVideos] = useState<VideoEntry[]>([newVideoEntry()]);
  const [saveStep, setSaveStep] = useState<SaveStep>({ status: "idle" });

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  // ── Video list helpers ────────────────────────────────────────────────────

  function updateVideo(id: string, patch: Partial<VideoEntry>) {
    setVideos((prev) =>
      prev.map((v) => (v._id === id ? { ...v, ...patch } : v))
    );
  }

  function addVideo() {
    setVideos((prev) => [...prev, { ...newVideoEntry(), artistId: courseArtistId }]);
  }

  function handleCourseArtistChange(id: string) {
    // Update videos that are still on the previous course default
    setVideos((prev) =>
      prev.map((v) =>
        v.artistId === prevCourseArtistId.current ? { ...v, artistId: id } : v
      )
    );
    prevCourseArtistId.current = id;
    setCourseArtistId(id);
  }

  function removeVideo(id: string) {
    setVideos((prev) => prev.filter((v) => v._id !== id));
  }

  function moveVideo(id: string, dir: -1 | 1) {
    setVideos((prev) => {
      const idx = prev.findIndex((v) => v._id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!courseName.trim()) {
      setSaveStep({ status: "error", message: "Course name is required." });
      return;
    }
    const missing = videos.find((v) => !v.title.trim() || !v.videoFile);
    if (missing) {
      setSaveStep({
        status: "error",
        message: "Every video needs a title and a video file.",
      });
      return;
    }

    try {
      // Step 1 — Upload course thumbnail once (if provided)
      let sharedThumbnailURL: string | null = null;
      if (courseThumbnailFile) {
        setSaveStep({
          status: "uploading",
          label: "Uploading course thumbnail…",
          videoIndex: 0,
          total: videos.length + 1,
        });
        sharedThumbnailURL = await uploadToS3(
          courseThumbnailFile,
          "courses/thumbnails"
        );
      }

      // Step 2 — Upload video files
      const uploadedVideos: Array<{
        videoURL: string;
        thumbnailURL: string | null;
        pdfURL: string | null;
        duration: number;
        entry: VideoEntry;
      }> = [];

      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        setSaveStep({
          status: "uploading",
          label: `Uploading "${v.title}" (${i + 1} of ${videos.length})…`,
          videoIndex: courseThumbnailFile ? i + 1 : i,
          total: courseThumbnailFile ? videos.length + 1 : videos.length,
        });

        const [videoURL, thumbnailURL, pdfURL, duration] = await Promise.all([
          uploadToS3(v.videoFile!, "courses/videos", (p) =>
            updateVideo(v._id, { videoProgress: p })
          ),
          // Use per-video thumbnail if provided, otherwise fall back to shared
          v.thumbnailFile
            ? uploadToS3(v.thumbnailFile, "courses/thumbnails", (p) =>
                updateVideo(v._id, { thumbnailProgress: p })
              )
            : Promise.resolve(sharedThumbnailURL),
          v.pdfFile
            ? uploadToS3(v.pdfFile, "courses/pdfs", (p) =>
                updateVideo(v._id, { pdfProgress: p })
              )
            : Promise.resolve(null),
          getVideoDuration(v.videoFile!),
        ]);

        uploadedVideos.push({ videoURL, thumbnailURL, pdfURL, duration, entry: v });
      }

      // Step 2 — Create Course
      setSaveStep({ status: "saving", label: "Creating course…" });
      const courseId = crypto.randomUUID();
      const { error: courseErr } = await supabase
        .from("Course")
        .insert({
          id: courseId,
          name: courseName.trim(),
          description: courseDescription.trim() || null,
          sortOrder: 9999,
          hidden: true, // hidden by default until ready to publish
        } as never);

      if (courseErr) throw courseErr;

      // Step 3 — Create Video rows
      setSaveStep({ status: "saving", label: "Saving videos…" });
      const videoIds: string[] = [];

      for (const { videoURL, thumbnailURL, pdfURL, duration, entry } of uploadedVideos) {
        const { data: vidData, error: vidErr } = await supabase
          .from("Video")
          .insert({
            id: crypto.randomUUID(),
            title: entry.title.trim(),
            description: entry.description.trim() || null,
            videoURL,
            thumbnailURL,
            duration,
            difficulty_level: entry.difficultyLevel,
            is_free: entry.isFree,
            contentType: "course",
            hasPDF: Boolean(pdfURL),
            pdfURL: pdfURL ?? null,
            hidden: false,
            views: 0,
            tags: null,
            level: null,
            seriesID: null,
          } as never)
          .select("id")
          .single();

        if (vidErr) throw vidErr;
        videoIds.push((vidData as { id: string }).id);
      }

      // Step 4 — Link videos to course (CourseContent)
      setSaveStep({ status: "saving", label: "Linking videos to course…" });
      const courseContentRows = videoIds.map((videoID, order) => ({
        courseID: courseId,
        videoID,
        order,
      }));

      const { error: ccErr } = await supabase
        .from("CourseContent")
        .insert(courseContentRows as never);
      if (ccErr) throw ccErr;

      // Step 5 — Link artists (ArtistContent)
      const artistRows = uploadedVideos
        .map(({ entry }, i) =>
          entry.artistId
            ? { artistID: entry.artistId, videoID: videoIds[i] }
            : null
        )
        .filter(Boolean);

      if (artistRows.length > 0) {
        setSaveStep({ status: "saving", label: "Linking artists…" });
        const { error: acErr } = await supabase
          .from("ArtistContent")
          .insert(artistRows as never);
        if (acErr) throw acErr;
      }

      setSaveStep({ status: "done" });
      setTimeout(() => navigate("/content"), 1500);
    } catch (err) {
      setSaveStep({
        status: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }

  const isBusy =
    saveStep.status === "uploading" || saveStep.status === "saving";

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/content">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Upload New Course
          </h1>
          <p className="text-muted-foreground mt-1">
            Add course details and videos — everything uploads and links
            automatically.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isBusy} size="lg">
          {isBusy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <BookOpen className="h-4 w-4 mr-2" />
          )}
          {isBusy ? "Saving…" : "Save Course"}
        </Button>
      </div>

      {/* Status banner */}
      {saveStep.status === "uploading" && (
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            {saveStep.label}
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.round(
                  ((saveStep.videoIndex + 0.5) / saveStep.total) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}
      {saveStep.status === "saving" && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-4 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {saveStep.label}
        </div>
      )}
      {saveStep.status === "done" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          Course saved! Redirecting…
        </div>
      )}
      {saveStep.status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          {saveStep.message}
        </Alert>
      )}

      {/* Course details */}
      <Card>
        <CardHeader>
          <CardTitle>Course Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="courseName">Name *</Label>
                <Input
                  id="courseName"
                  placeholder="Drum Fundamentals"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="courseDesc">Description</Label>
                <Textarea
                  id="courseDesc"
                  placeholder="A comprehensive course covering…"
                  rows={3}
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="courseArtist">Artist (applies to all videos)</Label>
                <select
                  id="courseArtist"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  value={courseArtistId}
                  onChange={(e) => handleCourseArtistChange(e.target.value)}
                  disabled={isBusy}
                >
                  <option value="">No artist</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Course-level thumbnail */}
            <CourseThumbnailZone
              preview={courseThumbnailPreview}
              disabled={isBusy}
              onFile={(file, preview) => {
                setCourseThumbnailFile(file);
                setCourseThumbnailPreview(preview);
              }}
            />
          </div>

          {courseThumbnailFile && (
            <p className="text-xs text-muted-foreground">
              This thumbnail will be used for all videos that don't have their own.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The course will be saved as <strong>hidden</strong> so you can
            review it before publishing.
          </p>
        </CardContent>
      </Card>

      {/* Videos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Videos{" "}
            <Badge variant="secondary" className="ml-1">
              {videos.length}
            </Badge>
          </h2>
          <Button variant="outline" onClick={addVideo} disabled={isBusy}>
            <Plus className="h-4 w-4 mr-2" />
            Add Video
          </Button>
        </div>

        {videos.map((video, idx) => (
          <VideoCard
            key={video._id}
            video={video}
            index={idx}
            total={videos.length}
            artists={artists}
            disabled={isBusy}
            sharedThumbnailPreview={courseThumbnailPreview}
            courseArtistId={courseArtistId}
            onChange={(patch) => updateVideo(video._id, patch)}
            onRemove={() => removeVideo(video._id)}
            onMoveUp={() => moveVideo(video._id, -1)}
            onMoveDown={() => moveVideo(video._id, 1)}
          />
        ))}

        <Button
          variant="outline"
          className="w-full"
          onClick={addVideo}
          disabled={isBusy}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Video
        </Button>
      </div>
    </div>
  );
}

// ─── VideoCard ─────────────────────────────────────────────────────────────────

interface VideoCardProps {
  video: VideoEntry;
  index: number;
  total: number;
  artists: { id: string; name: string }[];
  disabled: boolean;
  sharedThumbnailPreview: string | null;
  courseArtistId: string;
  onChange: (patch: Partial<VideoEntry>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function VideoCard({
  video,
  index,
  total,
  artists,
  disabled,
  sharedThumbnailPreview,
  courseArtistId,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: VideoCardProps) {
  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {/* Video header row */}
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
            {index + 1}
          </span>
          <Input
            placeholder="Video title *"
            value={video.title}
            onChange={(e) => onChange({ title: e.target.value })}
            disabled={disabled}
            className="flex-1 font-medium"
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveUp}
              disabled={disabled || index === 0}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveDown}
              disabled={disabled || index === total - 1}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            {total > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>

        {/* Description */}
        <Textarea
          placeholder="Description (optional)"
          value={video.description}
          onChange={(e) => onChange({ description: e.target.value })}
          disabled={disabled}
          rows={2}
        />

        {/* File uploads */}
        <div className="grid gap-4 md:grid-cols-3">
          <FileDropZone
            label="Video file *"
            icon={<Film className="h-6 w-6 text-muted-foreground" />}
            accept={{ "video/*": [".mp4", ".mov", ".m4v"] }}
            file={video.videoFile}
            progress={video.videoProgress}
            disabled={disabled}
            onFile={(f) => onChange({ videoFile: f, videoProgress: 0 })}
          />
          <ThumbnailDropZone
            file={video.thumbnailFile}
            preview={video.thumbnailPreview}
            sharedPreview={sharedThumbnailPreview}
            progress={video.thumbnailProgress}
            disabled={disabled}
            onFile={(f, preview) =>
              onChange({ thumbnailFile: f, thumbnailPreview: preview, thumbnailProgress: 0 })
            }
          />
          <FileDropZone
            label="PDF (optional)"
            icon={<FileText className="h-6 w-6 text-muted-foreground" />}
            accept={{ "application/pdf": [".pdf"] }}
            file={video.pdfFile}
            progress={video.pdfProgress}
            disabled={disabled}
            onFile={(f) => onChange({ pdfFile: f, pdfProgress: 0 })}
          />
        </div>

        {/* Metadata row */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              Artist
              {courseArtistId && video.artistId === courseArtistId && (
                <span className="text-xs text-muted-foreground font-normal">(course default)</span>
              )}
            </Label>
            <select
              className={selectClass}
              value={video.artistId}
              onChange={(e) => onChange({ artistId: e.target.value })}
              disabled={disabled}
            >
              <option value="">No artist</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <select
              className={selectClass}
              value={video.difficultyLevel}
              onChange={(e) =>
                onChange({ difficultyLevel: e.target.value as DifficultyLevel })
              }
              disabled={disabled}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Access</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={video.isFree}
                onCheckedChange={(v) => onChange({ isFree: v })}
                disabled={disabled}
              />
              <span className="text-sm">
                {video.isFree ? "Free" : "Premium"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── FileDropZone ──────────────────────────────────────────────────────────────

interface FileDropZoneProps {
  label: string;
  icon: React.ReactNode;
  accept: Record<string, string[]>;
  file: File | null;
  progress: number;
  disabled: boolean;
  onFile: (file: File) => void;
}

function FileDropZone({
  label,
  icon,
  accept,
  file,
  progress,
  disabled,
  onFile,
}: FileDropZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles: 1,
    disabled,
    onDrop: (files) => files[0] && onFile(files[0]),
  });

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors min-h-[90px] flex flex-col items-center justify-center gap-1 ${
          isDragActive
            ? "border-primary bg-primary/5"
            : file
            ? "border-green-400 bg-green-50"
            : "border-muted-foreground/25 hover:border-primary"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        {icon}
        {file ? (
          <>
            <p className="text-xs font-medium truncate max-w-full px-2">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {(file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {isDragActive ? "Drop here" : "Click or drag"}
          </p>
        )}
        {/* Upload progress bar */}
        {progress > 0 && progress < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {progress === 100 && (
          <CheckCircle2 className="absolute top-1 right-1 h-3.5 w-3.5 text-green-500" />
        )}
      </div>
    </div>
  );
}

// ─── CourseThumbnailZone ───────────────────────────────────────────────────────

interface CourseThumbnailZoneProps {
  preview: string | null;
  disabled: boolean;
  onFile: (file: File, preview: string) => void;
}

function CourseThumbnailZone({ preview, disabled, onFile }: CourseThumbnailZoneProps) {
  const previewRef = useRef<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    disabled,
    onDrop: (files) => {
      const f = files[0];
      if (!f) return;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      const url = URL.createObjectURL(f);
      previewRef.current = url;
      onFile(f, url);
    },
  });

  return (
    <div className="space-y-1.5">
      <Label>Course Thumbnail</Label>
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-lg cursor-pointer transition-colors overflow-hidden flex items-center justify-center h-[140px] ${
          isDragActive
            ? "border-primary bg-primary/5"
            : preview
            ? "border-green-400"
            : "border-muted-foreground/25 hover:border-primary"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        {preview ? (
          <>
            <img src={preview} alt="Course thumbnail" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-end justify-center pb-1.5">
              <span className="text-xs bg-black/50 text-white rounded px-1.5 py-0.5">
                used for all videos
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 p-4 text-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground leading-snug">
              {isDragActive ? "Drop here" : "Shared thumbnail\n(optional)"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ThumbnailDropZone ─────────────────────────────────────────────────────────

interface ThumbnailDropZoneProps {
  file: File | null;
  preview: string | null;
  sharedPreview?: string | null;
  progress: number;
  disabled: boolean;
  onFile: (file: File, preview: string) => void;
}

function ThumbnailDropZone({
  file,
  preview,
  sharedPreview,
  progress,
  disabled,
  onFile,
}: ThumbnailDropZoneProps) {
  const previewRef = useRef<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    disabled,
    onDrop: (files) => {
      const f = files[0];
      if (!f) return;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      const url = URL.createObjectURL(f);
      previewRef.current = url;
      onFile(f, url);
    },
  });

  return (
    <div className="space-y-1.5">
      <Label>Thumbnail</Label>
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-lg cursor-pointer transition-colors min-h-[90px] overflow-hidden flex items-center justify-center ${
          isDragActive
            ? "border-primary bg-primary/5"
            : file
            ? "border-green-400"
            : "border-muted-foreground/25 hover:border-primary"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        {preview ? (
          <img src={preview} alt="Thumbnail" className="h-full w-full object-cover" />
        ) : sharedPreview ? (
          <div className="relative h-full w-full">
            <img src={sharedPreview} alt="Course thumbnail" className="h-full w-full object-cover opacity-60" />
            <div className="absolute inset-0 flex items-end justify-center pb-1">
              <span className="text-xs bg-black/50 text-white rounded px-1">course default</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 p-4">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {isDragActive ? "Drop here" : "Click or drag"}
            </p>
          </div>
        )}
        {progress > 0 && progress < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {progress === 100 && (
          <CheckCircle2 className="absolute top-1 right-1 h-3.5 w-3.5 text-green-500" />
        )}
      </div>
    </div>
  );
}
