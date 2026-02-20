import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/stores";
import { AdminGuard } from "@/components/guards/AdminGuard";
import { DashboardLayout } from "@/components/layout";
import {
  LoginPage,
  UnauthorizedPage,
  DashboardPage,
  AnalyticsPage,
  UsersPage,
  GoalsPage,
  BookingsPage,
  NotificationsListPage,
  NotificationFormPage,
  NotificationDetailPage,
  ContentListPage,
  VideoFormPage,
  SeriesFormPage,
  ArtistFormPage,
  GoalFormPage,
  SiteFormPage,
  RoomFormPage,
} from "@/pages";
import { AutomatedTriggersPage } from "@/pages/notifications";
import {
  FeatureRequestsListPage,
  FeatureRequestDetailPage,
} from "@/pages/feature-requests";

function App() {
  const { initialize, isLoading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">
            Loading Palace Drum Clinic Admin...
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Protected admin routes */}
        <Route
          path="/"
          element={
            <AdminGuard>
              <DashboardLayout />
            </AdminGuard>
          }
        >
          <Route index element={<DashboardPage />} />

          {/* Notifications */}
          <Route path="notifications" element={<NotificationsListPage />} />
          <Route path="notifications/new" element={<NotificationFormPage />} />
          <Route
            path="notifications/:id"
            element={<NotificationDetailPage />}
          />
          <Route
            path="notifications/:id/edit"
            element={<NotificationFormPage />}
          />
          <Route
            path="notifications/triggers"
            element={<AutomatedTriggersPage />}
          />

          {/* Content */}
          <Route path="content" element={<ContentListPage />} />
          <Route path="content/videos/new" element={<VideoFormPage />} />
          <Route path="content/videos/:id/edit" element={<VideoFormPage />} />
          <Route path="content/series/new" element={<SeriesFormPage />} />
          <Route path="content/series/:id/edit" element={<SeriesFormPage />} />
          <Route path="content/artists/new" element={<ArtistFormPage />} />
          <Route path="content/artists/:id/edit" element={<ArtistFormPage />} />

          {/* Analytics */}
          <Route path="analytics" element={<AnalyticsPage />} />

          {/* Users */}
          <Route path="users" element={<UsersPage />} />

          {/* Goals */}
          <Route path="goals" element={<GoalsPage />} />
          <Route path="goals/new" element={<GoalFormPage />} />
          <Route path="goals/:id/edit" element={<GoalFormPage />} />

          {/* Bookings */}
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="bookings/sites/new" element={<SiteFormPage />} />
          <Route path="bookings/sites/:id/edit" element={<SiteFormPage />} />
          <Route path="bookings/rooms/new" element={<RoomFormPage />} />
          <Route path="bookings/rooms/:id/edit" element={<RoomFormPage />} />

          {/* Feature Requests */}
          <Route path="feature-requests" element={<FeatureRequestsListPage />} />
          <Route path="feature-requests/:id" element={<FeatureRequestDetailPage />} />
        </Route>

        {/* Catch all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
