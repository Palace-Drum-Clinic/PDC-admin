import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, User, Save, Upload, X, Image } from "lucide-react";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useContentStore } from "@/stores";
import { artistSchema, type ArtistInput } from "@/types/schemas";
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
} from "@/components/ui";

export function ArtistFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const {
    artists,
    isLoading,
    error,
    createArtist,
    updateArtist,
    fetchArtists,
  } = useContentStore();

  const [isSaving, setIsSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ArtistInput>({
    resolver: zodResolver(artistSchema),
    defaultValues: {
      name: "",
      bio: "",
      profileImageURL: "",
    },
  });

  const currentImageUrl = watch("profileImageURL");

  useEffect(() => {
    if (isEditing) {
      fetchArtists();
    }
  }, [isEditing, fetchArtists]);

  useEffect(() => {
    if (isEditing && artists.length > 0) {
      const item = artists.find((a) => a.id === id) as
        | (typeof artists)[0] & { profileImageURL?: string | null }
        | undefined;
      if (item) {
        reset({
          name: item.name,
          bio: item.bio || "",
          profileImageURL: item.profileImageURL || "",
        });
        if (item.profileImageURL) {
          setImagePreview(item.profileImageURL);
        }
      }
    }
  }, [isEditing, id, artists, reset]);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
  });

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setValue("profileImageURL", "");
  };

  const onSubmit = async (data: ArtistInput) => {
    setIsSaving(true);
    try {
      let finalImageUrl = data.profileImageURL;

      if (imageFile) {
        setIsUploading(true);
        finalImageUrl = await uploadToS3(imageFile, "artists/images", (p) => {
          setUploadProgress(p);
        });
        setIsUploading(false);
      }

      const payload = { ...data, profileImageURL: finalImageUrl };

      if (isEditing && id) {
        await updateArtist(id, payload);
      } else {
        await createArtist(payload);
      }
      navigate("/content");
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  if (isLoading && isEditing) {
    return <LoadingState message="Loading artist..." />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/content">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8" />
            {isEditing ? "Edit Artist" : "Add Artist"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditing
              ? "Update artist details."
              : "Add a new artist or instructor."}
          </p>
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Artist Details</CardTitle>
            <CardDescription>
              Information about the artist or instructor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="John Smith" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="A professional drummer with 20 years of experience..."
                rows={4}
                {...register("bio")}
              />
            </div>

            {/* Profile Image Upload */}
            <div className="space-y-2">
              <Label>Profile Image</Label>
              {imagePreview ? (
                <div className="relative w-40 h-40">
                  <img
                    src={imagePreview}
                    alt="Profile preview"
                    className="w-40 h-40 rounded-lg object-cover border"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {imageFile && (
                    <p className="mt-1 text-xs text-muted-foreground truncate w-40">
                      {imageFile.name}
                    </p>
                  )}
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragActive
                      ? "Drop image here"
                      : "Drag & drop or click to upload"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WebP
                  </p>
                </div>
              )}
              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uploading to S3...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {/* Hidden field to carry existing URL when not replacing */}
              <input type="hidden" {...register("profileImageURL")} />
              {!imageFile && currentImageUrl && (
                <p className="text-xs text-muted-foreground">
                  Current image will be kept
                </p>
              )}
            </div>


          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/content")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || isUploading}>
              {isUploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-bounce" />
                  Uploading... {uploadProgress}%
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Add Artist"}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
