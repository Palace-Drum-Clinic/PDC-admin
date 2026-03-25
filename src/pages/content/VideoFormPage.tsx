import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Video, Save, Upload, X, Image, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useContentStore } from "@/stores";
import { videoSchema, type VideoInput } from "@/types/schemas";
import { uploadToS3 } from "@/lib/s3";
import {
  Button,
  Input,
  Textarea,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Alert,
  LoadingState,
  Switch,
} from "@/components/ui";

function DropZone({
  label,
  accept,
  acceptLabel,
  file,
  existingUrl,
  onFile,
  onClear,
  icon: Icon,
}: {
  label: string;
  accept: Record<string, string[]>;
  acceptLabel: string;
  file: File | null;
  existingUrl?: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
  icon: React.ElementType;
}) {
  const onDrop = useCallback((accepted: File[]) => { if (accepted[0]) onFile(accepted[0]); }, [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept, maxFiles: 1 });

  const displayName = file?.name ?? (existingUrl ? existingUrl.split("/").pop() : null);
  const hasContent = file || existingUrl;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hasContent ? (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="flex-1 text-sm truncate">{displayName}</span>
          {file && <span className="text-xs text-muted-foreground">new</span>}
          {existingUrl && !file && <span className="text-xs text-muted-foreground">existing</span>}
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          }`}
        >
          <input {...getInputProps()} />
          <Icon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isDragActive ? "Drop here" : "Drag & drop or click to select"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{acceptLabel}</p>
        </div>
      )}
    </div>
  );
}

function UploadProgress({ label, progress }: { label: string; progress: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function VideoFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const { videos, artists, isLoading, error, createVideo, updateVideo, fetchVideos, fetchArtists } =
    useContentStore();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // File state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [existingThumbUrl, setExistingThumbUrl] = useState<string | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const [autoDuration, setAutoDuration] = useState<number | null>(null);

  // Upload progress
  const [videoProgress, setVideoProgress] = useState(0);
  const [thumbProgress, setThumbProgress] = useState(0);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [currentUpload, setCurrentUpload] = useState<string | null>(null);

  const videoElRef = useRef<HTMLVideoElement>(null);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<VideoInput>({
    resolver: zodResolver(videoSchema),
    defaultValues: { title: "", description: "", artist_id: "", difficulty_level: "beginner", is_free: true },
  });

  useEffect(() => {
    fetchArtists();
    if (isEditing) fetchVideos();
  }, [isEditing, fetchVideos, fetchArtists]);

  useEffect(() => {
    if (isEditing && videos.length > 0) {
      const video = videos.find((v) => v.id === id);
      if (video) {
        const v = video as never as Record<string, unknown>;
        reset({
          title: (v["title"] as string) || "",
          description: (v["description"] as string) || "",
          artist_id: "",
          difficulty_level: (v["difficulty_level"] as "beginner" | "intermediate" | "advanced" | null) || "beginner",
          is_free: (v["is_free"] as boolean) ?? true,
        } as VideoInput);
        setExistingVideoUrl((video as never as Record<string, string>)["videoURL"] || null);
        setExistingThumbUrl((video as never as Record<string, string>)["thumbnailURL"] || null);
        setExistingPdfUrl((video as never as Record<string, string>)["pdfURL"] || null);
      }
    }
  }, [isEditing, id, videos, reset]);

  // Auto-extract duration when video file is selected
  useEffect(() => {
    if (!videoFile) { setAutoDuration(null); return; }
    const url = URL.createObjectURL(videoFile);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      setAutoDuration(Math.round(el.duration));
      URL.revokeObjectURL(url);
    };
    el.src = url;
  }, [videoFile]);

  const onSubmit = async (data: VideoInput) => {
    if (!isEditing && !videoFile) {
      setSaveError("Please select a video file to upload.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      let videoURL = existingVideoUrl || "";
      let thumbnailURL = existingThumbUrl || undefined;
      let pdfURL = existingPdfUrl || undefined;
      let duration = autoDuration ?? 0;

      if (videoFile) {
        setCurrentUpload("Uploading video...");
        videoURL = await uploadToS3(videoFile, "courses/videos", setVideoProgress);
        duration = autoDuration ?? 0;
      }

      if (thumbnailFile) {
        setCurrentUpload("Uploading thumbnail...");
        thumbnailURL = await uploadToS3(thumbnailFile, "courses/thumbnails", setThumbProgress);
      }

      if (pdfFile) {
        setCurrentUpload("Uploading PDF...");
        pdfURL = await uploadToS3(pdfFile, "courses/pdfs", setPdfProgress);
      }

      setCurrentUpload(null);

      if (isEditing && id) {
        await updateVideo(id, {
          title: data.title,
          description: data.description,
          artist_id: data.artist_id || undefined,
          thumbnailURL,
          pdfURL,
          hasPDF: Boolean(pdfURL),
          difficulty_level: data.difficulty_level,
          is_free: data.is_free,
        });
      } else {
        await createVideo({
          title: data.title,
          description: data.description,
          artist_id: data.artist_id,
          videoURL,
          thumbnailURL,
          pdfURL,
          hasPDF: Boolean(pdfURL),
          duration,
          contentType: "video",
          difficulty_level: data.difficulty_level,
          is_free: data.is_free,
        });
      }

      navigate("/content");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsSaving(false);
      setCurrentUpload(null);
    }
  };

  const isUploading = isSaving && currentUpload !== null;

  if (isLoading && isEditing) return <LoadingState message="Loading video..." />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/content">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="h-8 w-8" />
            {isEditing ? "Edit Video" : "Add Video"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditing ? "Update video details." : "Upload a new standalone video."}
          </p>
        </div>
      </div>

      {(error || saveError) && (
        <Alert variant="destructive">{saveError || error}</Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" placeholder="Beginner Drum Rudiments" {...register("title")} />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} placeholder="What will students learn?" {...register("description")} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Artist *</Label>
                <Controller
                  control={control}
                  name="artist_id"
                  render={({ field }) => (
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select artist...</option>
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  )}
                />
                {errors.artist_id && <p className="text-sm text-destructive">{errors.artist_id.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Controller
                  control={control}
                  name="difficulty_level"
                  render={({ field }) => (
                    <select
                      {...field}
                      value={field.value || "beginner"}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="all">All Levels</option>
                    </select>
                  )}
                />
              </div>
            </div>

            <Controller
              control={control}
              name="is_free"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Switch id="is_free" checked={field.value} onCheckedChange={field.onChange} />
                  <Label htmlFor="is_free">Free content</Label>
                </div>
              )}
            />
          </CardContent>
        </Card>

        {/* Files */}
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>All files are uploaded to S3 automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DropZone
              label={isEditing ? "Video file (leave empty to keep existing)" : "Video file *"}
              accept={{ "video/*": [".mp4", ".mov", ".m4v"] }}
              acceptLabel="MP4, MOV"
              file={videoFile}
              existingUrl={existingVideoUrl}
              onFile={setVideoFile}
              onClear={() => { setVideoFile(null); if (!isEditing) setExistingVideoUrl(null); }}
              icon={Video}
            />
            {autoDuration !== null && (
              <p className="text-xs text-muted-foreground">
                Duration detected: {Math.floor(autoDuration / 60)}m {autoDuration % 60}s
              </p>
            )}

            <DropZone
              label="Thumbnail (optional)"
              accept={{ "image/*": [".jpg", ".jpeg", ".png", ".webp"] }}
              acceptLabel="JPG, PNG, WebP"
              file={thumbnailFile}
              existingUrl={existingThumbUrl}
              onFile={setThumbnailFile}
              onClear={() => { setThumbnailFile(null); setExistingThumbUrl(null); }}
              icon={Image}
            />

            <DropZone
              label="PDF / Sheet music (optional)"
              accept={{ "application/pdf": [".pdf"] }}
              acceptLabel="PDF"
              file={pdfFile}
              existingUrl={existingPdfUrl}
              onFile={setPdfFile}
              onClear={() => { setPdfFile(null); setExistingPdfUrl(null); }}
              icon={FileText}
            />

            {/* Upload progress */}
            {isSaving && (
              <div className="space-y-2 pt-2 border-t">
                {videoFile && <UploadProgress label="Video" progress={videoProgress} />}
                {thumbnailFile && <UploadProgress label="Thumbnail" progress={thumbProgress} />}
                {pdfFile && <UploadProgress label="PDF" progress={pdfProgress} />}
                {currentUpload && <p className="text-xs text-muted-foreground">{currentUpload}</p>}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/content")}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isUploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-bounce" />
                  Uploading...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Add Video"}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Hidden video element for duration extraction */}
      <video ref={videoElRef} className="hidden" />
    </div>
  );
}
