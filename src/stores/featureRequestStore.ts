import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type {
  Database,
  FeatureRequest,
  FeatureRequestComment,
  FeatureRequestVote,
  FeatureRequestAdminLog,
} from "../types/database";
import type {
  FeatureRequestInput,
  FeatureRequestUpdateInput,
  FeatureRequestCommentInput,
  FeatureRequestFilter,
} from "../types/schemas";

interface FeatureRequestState {
  // State
  requests: FeatureRequest[];
  selectedRequest: FeatureRequest | null;
  comments: FeatureRequestComment[];
  votes: FeatureRequestVote[];
  adminLogs: FeatureRequestAdminLog[];
  isLoading: boolean;
  error: string | null;

  // Filter state
  filters: FeatureRequestFilter;
  setFilters: (filters: FeatureRequestFilter) => void;

  // Actions
  fetchRequests: () => Promise<void>;
  fetchRequestById: (id: string) => Promise<void>;
  fetchComments: (requestId: string) => Promise<void>;
  fetchVotes: (requestId: string) => Promise<void>;
  fetchAdminLogs: (requestId: string) => Promise<void>;
  createRequest: (
    input: FeatureRequestInput,
  ) => Promise<{ success: boolean; data?: FeatureRequest; error?: string }>;
  updateRequest: (
    id: string,
    input: FeatureRequestUpdateInput,
  ) => Promise<{ success: boolean; data?: FeatureRequest; error?: string }>;
  addComment: (
    requestId: string,
    input: FeatureRequestCommentInput,
  ) => Promise<{
    success: boolean;
    data?: FeatureRequestComment;
    error?: string;
  }>;
  updateStatus: (
    id: string,
    status: Database["public"]["Tables"]["feature_requests"]["Row"]["status"],
    notes?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updatePriority: (
    id: string,
    priority: Database["public"]["Tables"]["feature_requests"]["Row"]["priority"],
    notes?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  archiveRequest: (
    id: string,
    reason: string,
  ) => Promise<{ success: boolean; error?: string }>;
  unarchiveRequest: (
    id: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteRequest: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const useFeatureRequestStore = create<FeatureRequestState>(
  (set, get) => ({
    // Initial state
    requests: [],
    selectedRequest: null,
    comments: [],
    votes: [],
    adminLogs: [],
    isLoading: false,
    error: null,
    filters: {},

    setFilters: (filters) => set({ filters }),

    fetchRequests: async () => {
      set({ isLoading: true, error: null });
      try {
        const { filters } = get();
        let query = supabase
          .from("feature_requests")
          .select(
            `
            *
          `,
          )
          .order("created_at", { ascending: false });

        // Apply filters
        if (filters.status && filters.status.length > 0) {
          query = query.in("status", filters.status);
        }
        if (filters.priority && filters.priority.length > 0) {
          query = query.in("priority", filters.priority);
        }
        if (filters.category && filters.category.length > 0) {
          query = query.in("category", filters.category);
        }
        if (filters.is_archived !== undefined) {
          query = query.eq("is_archived", filters.is_archived);
        }
        if (filters.created_after) {
          query = query.gte("created_at", filters.created_after);
        }
        if (filters.created_before) {
          query = query.lte("created_at", filters.created_before);
        }
        if (filters.min_votes !== undefined) {
          query = query.gte("vote_count", filters.min_votes);
        }
        if (filters.search) {
          query = query.or(
            `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
          );
        }

        const { data, error } = await query;

        if (error) throw error;

        set({
          requests: (data as FeatureRequest[]) || [],
          isLoading: false,
        });
      } catch (error) {
        set({
          error:
            error instanceof Error ? error.message : "Failed to fetch requests",
          isLoading: false,
        });
      }
    },

    fetchRequestById: async (id: string) => {
      set({ isLoading: true, error: null });
      try {
        const { data, error } = await supabase
          .from("feature_requests")
          .select(
            `
            *
          `,
          )
          .eq("id", id)
          .single();

        if (error) throw error;

        set({
          selectedRequest: data as FeatureRequest,
          isLoading: false,
        });
      } catch (error) {
        set({
          error:
            error instanceof Error ? error.message : "Failed to fetch request",
          isLoading: false,
        });
      }
    },

    fetchComments: async (requestId: string) => {
      try {
        const { data, error } = await supabase
          .from("feature_request_comments")
          .select(
            `
            *
          `,
          )
          .eq("feature_request_id", requestId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true });

        if (error) throw error;

        set({ comments: (data as never) || [] });
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      }
    },

    fetchVotes: async (requestId: string) => {
      try {
        const { data, error } = await supabase
          .from("feature_request_votes")
          .select("*")
          .eq("feature_request_id", requestId)
          .order("voted_at", { ascending: false });

        if (error) throw error;

        set({ votes: (data as FeatureRequestVote[]) || [] });
      } catch (error) {
        console.error("Failed to fetch votes:", error);
      }
    },

    fetchAdminLogs: async (requestId: string) => {
      try {
        const { data, error } = await supabase
          .from("feature_request_admin_log")
          .select(
            `
            *
          `,
          )
          .eq("feature_request_id", requestId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        set({ adminLogs: (data as never) || [] });
      } catch (error) {
        console.error("Failed to fetch admin logs:", error);
      }
    },

    createRequest: async (input: FeatureRequestInput) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data, error } = await supabase
          .from("feature_requests")
          .insert({
            ...input,
            created_by: user.id,
          } as never)
          .select()
          .single();

        if (error) throw error;

        set({ requests: [data as FeatureRequest, ...get().requests] });

        return { success: true, data: data as FeatureRequest };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to create request",
        };
      }
    },

    updateRequest: async (id: string, input: FeatureRequestUpdateInput) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Get current state for logging
        const currentRequest = get().requests.find((r) => r.id === id);

        const { data, error } = await supabase
          .from("feature_requests")
          .update({
            ...input,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;

        // Log the change
        if (currentRequest) {
          await supabase.from("feature_request_admin_log").insert({
            feature_request_id: id,
            admin_user_id: user.id,
            action: "update",
            old_value: currentRequest,
            new_value: input,
          } as never);
        }

        set({
          requests: get().requests.map((r) =>
            r.id === id ? (data as FeatureRequest) : r,
          ),
          selectedRequest:
            get().selectedRequest?.id === id
              ? (data as FeatureRequest)
              : get().selectedRequest,
        });

        return { success: true, data: data as FeatureRequest };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to update request",
        };
      }
    },

    addComment: async (
      requestId: string,
      input: FeatureRequestCommentInput,
    ) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data, error } = await supabase
          .from("feature_request_comments")
          .insert({
            feature_request_id: requestId,
            user_id: user.id,
            content: input.content,
            is_admin_comment: input.is_admin_comment ?? true,
          } as never)
          .select()
          .single();

        if (error) throw error;

        // Update comment count
        await supabase.rpc("increment_feature_request_comment_count", {
          request_id: requestId,
        });

        set({ comments: [...get().comments, data as FeatureRequestComment] });

        return { success: true, data: data as FeatureRequestComment };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to add comment",
        };
      }
    },

    updateStatus: async (id: string, status, notes?: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const currentRequest = get().requests.find((r) => r.id === id);
        const oldStatus = currentRequest?.status;

        const { error } = await supabase
          .from("feature_requests")
          .update({
            status,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", id);

        if (error) throw error;

        // Log the status change
        await supabase.from("feature_request_admin_log").insert({
          feature_request_id: id,
          admin_user_id: user.id,
          action: "status_change",
          old_value: { status: oldStatus },
          new_value: { status },
          notes,
        } as never);

        // Refresh the request
        await get().fetchRequests();

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to update status",
        };
      }
    },

    updatePriority: async (id: string, priority, notes?: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const currentRequest = get().requests.find((r) => r.id === id);
        const oldPriority = currentRequest?.priority;

        const { error } = await supabase
          .from("feature_requests")
          .update({
            priority,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", id);

        if (error) throw error;

        // Log the priority change
        await supabase.from("feature_request_admin_log").insert({
          feature_request_id: id,
          admin_user_id: user.id,
          action: "priority_change",
          old_value: { priority: oldPriority },
          new_value: { priority },
          notes,
        } as never);

        // Refresh the request
        await get().fetchRequests();

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update priority",
        };
      }
    },

    archiveRequest: async (id: string, reason: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
          .from("feature_requests")
          .update({
            is_archived: true,
            archive_reason: reason,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", id);

        if (error) throw error;

        // Log the archive action
        await supabase.from("feature_request_admin_log").insert({
          feature_request_id: id,
          admin_user_id: user.id,
          action: "archive",
          new_value: { archive_reason: reason },
        } as never);

        await get().fetchRequests();

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to archive request",
        };
      }
    },

    unarchiveRequest: async (id: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
          .from("feature_requests")
          .update({
            is_archived: false,
            archive_reason: null,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", id);

        if (error) throw error;

        // Log the unarchive action
        await supabase.from("feature_request_admin_log").insert({
          feature_request_id: id,
          admin_user_id: user.id,
          action: "unarchive",
        } as never);

        await get().fetchRequests();

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to unarchive request",
        };
      }
    },

    deleteRequest: async (id: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
          .from("feature_requests")
          .delete()
          .eq("id", id);

        if (error) throw error;

        set({ requests: get().requests.filter((r) => r.id !== id) });

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete request",
        };
      }
    },
  }),
);
