import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { ArrowLeft, BookOpen, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { useContentStore } from "@/stores";
import type { CourseInput } from "@/stores/contentStore";
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

export function CourseFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const { courses, isLoading, error, createCourse, updateCourse, fetchCourses } =
    useContentStore();
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CourseInput>({
    defaultValues: {
      name: "",
      description: "",
      sortOrder: 0,
    },
  });

  useEffect(() => {
    if (isEditing) {
      fetchCourses();
    }
  }, [isEditing, fetchCourses]);

  useEffect(() => {
    if (isEditing && courses.length > 0) {
      const item = courses.find((c) => c.id === id);
      if (item) {
        reset({
          name: item.name,
          description: item.description || "",
          sortOrder: item.sortOrder ?? 0,
        });
      }
    }
  }, [isEditing, id, courses, reset]);

  const onSubmit = async (data: CourseInput) => {
    setIsSaving(true);
    try {
      if (isEditing && id) {
        await updateCourse(id, data);
      } else {
        await createCourse(data);
      }
      navigate("/content");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && isEditing) {
    return <LoadingState message="Loading course..." />;
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
            <BookOpen className="h-8 w-8" />
            {isEditing ? "Edit Course" : "Create Course"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditing ? "Update course details." : "Create a new course."}
          </p>
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
            <CardDescription>Information about the course.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Drum Fundamentals"
                {...register("name", { required: "Name is required" })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="A comprehensive course covering..."
                rows={4}
                {...register("description")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                min="0"
                {...register("sortOrder", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first.
              </p>
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
            <Button type="submit" disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Create Course"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
