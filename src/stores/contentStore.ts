import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Video, Artist } from "@/types";
import type { ArtistInput } from "@/types/schemas";

export interface VideoCreatePayload {
  title: string;
  description?: string;
  artist_id: string;
  videoURL: string;
  thumbnailURL?: string;
  pdfURL?: string;
  hasPDF: boolean;
  duration: number;
  contentType: string;
  difficulty_level?: string | null;
  is_free: boolean;
}

export interface VideoUpdatePayload {
  title?: string;
  description?: string;
  artist_id?: string;
  thumbnailURL?: string;
  pdfURL?: string;
  hasPDF?: boolean;
  difficulty_level?: string | null;
  is_free?: boolean;
}

export interface CourseVideo {
  order: number;
  videoID: string;
  Video: {
    id: string;
    title: string;
    duration: number;
    thumbnailURL: string | null;
    difficulty_level: string | null;
  } | null;
}

export interface CourseWithVideos {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  sortOrder: number | null;
  hidden: boolean;
  CourseContent: CourseVideo[];
}

export interface CourseInput {
  name: string;
  description?: string | null;
  sortOrder?: number | null;
}

interface ContentState {
  videos: Video[];
  courses: CourseWithVideos[];
  artists: Artist[];
  isLoading: boolean;
  error: string | null;

  // Videos
  fetchVideos: () => Promise<void>;
  createVideo: (
    input: VideoCreatePayload
  ) => Promise<{ success: boolean; error?: string; data?: Video }>;
  updateVideo: (
    id: string,
    input: VideoUpdatePayload
  ) => Promise<{ success: boolean; error?: string }>;
  deleteVideo: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Courses
  fetchCourses: () => Promise<void>;
  createCourse: (
    input: CourseInput
  ) => Promise<{ success: boolean; error?: string; data?: CourseWithVideos }>;
  updateCourse: (
    id: string,
    input: Partial<CourseInput>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteCourse: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveCourseOrder: (
    orderedIds: string[]
  ) => Promise<{ success: boolean; error?: string }>;
  toggleCourseVisibility: (
    id: string,
    hidden: boolean
  ) => Promise<{ success: boolean; error?: string }>;

  // Artists
  fetchArtists: () => Promise<void>;
  createArtist: (
    input: ArtistInput
  ) => Promise<{ success: boolean; error?: string; data?: Artist }>;
  updateArtist: (
    id: string,
    input: Partial<ArtistInput>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteArtist: (id: string) => Promise<{ success: boolean; error?: string }>;

  clearError: () => void;
}

export const useContentStore = create<ContentState>((set, get) => ({
  videos: [],
  courses: [],
  artists: [],
  isLoading: false,
  error: null,

  // Videos
  fetchVideos: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("Video")
        .select("*")
        .order("createdAt", { ascending: false });

      if (error) throw error;
      set({ videos: data || [] });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch videos",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  createVideo: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const videoId = crypto.randomUUID();
      const { artist_id, ...videoData } = input;

      const { data, error } = await supabase
        .from("Video")
        .insert({ id: videoId, ...videoData } as never)
        .select()
        .single();

      if (error) throw error;

      // Link artist
      if (artist_id) {
        await supabase
          .from("ArtistContent")
          .insert({ artistID: artist_id, videoID: videoId } as never);
      }

      set({ videos: [...get().videos, data as Video] });
      return { success: true, data: data as Video };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create video";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  updateVideo: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const { artist_id, ...videoData } = input;

      if (Object.keys(videoData).length > 0) {
        const { data, error } = await supabase
          .from("Video")
          .update(videoData as never)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;

        set({
          videos: get().videos.map((v) => (v.id === id ? (data as Video) : v)),
        });
      }

      // Update artist link if changed
      if (artist_id) {
        await supabase.from("ArtistContent").delete().eq("videoID", id);
        await supabase
          .from("ArtistContent")
          .insert({ artistID: artist_id, videoID: id } as never);
      }

      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update video";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  deleteVideo: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.from("Video").delete().eq("id", id);

      if (error) throw error;

      set({ videos: get().videos.filter((v) => v.id !== id) });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete video";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  // Courses
  fetchCourses: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("Course")
        .select(
          `*, CourseContent(order, videoID, Video(id, title, duration, thumbnailURL, difficulty_level))`
        )
        .order("sortOrder", { ascending: true });

      if (error) throw error;
      set({ courses: (data as CourseWithVideos[]) || [] });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch courses",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  createCourse: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("Course")
        .insert(input as never)
        .select(
          `*, CourseContent(order, videoID, Video(id, title, duration, thumbnailURL, difficulty_level))`
        )
        .single();

      if (error) throw error;

      const course = data as CourseWithVideos;
      set({ courses: [...get().courses, course] });
      return { success: true, data: course };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create course";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  updateCourse: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("Course")
        .update(input as never)
        .eq("id", id)
        .select(
          `*, CourseContent(order, videoID, Video(id, title, duration, thumbnailURL, difficulty_level))`
        )
        .single();

      if (error) throw error;

      set({
        courses: get().courses.map((c) =>
          c.id === id ? (data as CourseWithVideos) : c
        ),
      });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update course";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  deleteCourse: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.from("Course").delete().eq("id", id);

      if (error) throw error;

      set({ courses: get().courses.filter((c) => c.id !== id) });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete course";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  saveCourseOrder: async (orderedIds) => {
    try {
      const updates = orderedIds.map((id, index) =>
        supabase.from("Course").update({ sortOrder: index } as never).eq("id", id)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      const error = failed?.error;

      if (error) throw error;

      // Update local order
      const reordered: CourseWithVideos[] = [];
      for (const [index, id] of orderedIds.entries()) {
        const course = get().courses.find((c) => c.id === id);
        if (course) reordered.push({ ...course, sortOrder: index });
      }
      set({ courses: reordered });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save course order";
      return { success: false, error: message };
    }
  },

  toggleCourseVisibility: async (id, hidden) => {
    try {
      const { error } = await supabase
        .from("Course")
        .update({ hidden } as never)
        .eq("id", id);

      if (error) throw error;

      set({
        courses: get().courses.map((c) =>
          c.id === id ? { ...c, hidden } : c
        ),
      });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update course";
      return { success: false, error: message };
    }
  },

  // Artists
  fetchArtists: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("Artist")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      set({ artists: data || [] });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to fetch artists",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  createArtist: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("Artist")
        .insert({ id: crypto.randomUUID(), ...input } as never)
        .select()
        .single();

      if (error) throw error;

      set({ artists: [...get().artists, data as Artist] });
      return { success: true, data: data as Artist };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create artist";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  updateArtist: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("Artist")
        .update(input as never)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      set({
        artists: get().artists.map((a) => (a.id === id ? (data as Artist) : a)),
      });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update artist";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  deleteArtist: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.from("Artist").delete().eq("id", id);

      if (error) throw error;

      set({ artists: get().artists.filter((a) => a.id !== id) });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete artist";
      set({ error: message });
      return { success: false, error: message };
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
