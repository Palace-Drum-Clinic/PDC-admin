import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bell,
  Video,
  Users,
  BarChart3,
  Target,
  Calendar,
  LogOut,
  Drum,
  Lightbulb,
} from "lucide-react";
import { useAuthStore } from "@/stores";
import { Button } from "@/components/ui";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Content", href: "/content", icon: Video },
  { name: "Users", href: "/users", icon: Users },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Drum Zone", href: "/bookings", icon: Calendar },
  { name: "Feature Requests", href: "/feature-requests", icon: Lightbulb },
];

export function Sidebar() {
  const { appUser, signOut } = useAuthStore();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Drum className="h-8 w-8 text-primary" />
        <div>
          <h1 className="font-bold text-lg">PDC Admin</h1>
          <p className="text-xs text-muted-foreground">Palace Drum Clinic</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {appUser?.firstName?.charAt(0) || "A"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">
              {appUser?.firstName} {appUser?.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {appUser?.role}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
