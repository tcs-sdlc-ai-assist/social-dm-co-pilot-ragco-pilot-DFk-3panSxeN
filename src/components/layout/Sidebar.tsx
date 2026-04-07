"use client";

import { useState, useCallback, useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useSession } from "next-auth/react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SidebarProps {
  /** Optional additional CSS classes */
  className?: string;
  /** Currently active route path */
  activePath?: string;
}

// ─── Navigation Items ────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: "dashboard" | "inbox" | "leads" | "notifications" | "settings" | "analytics";
  badge?: "unread" | "none";
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard", badge: "none" },
  { label: "Inbox", href: "/inbox", icon: "inbox", badge: "none" },
  { label: "Leads", href: "/leads", icon: "leads", badge: "none" },
  { label: "Notifications", href: "/notifications", icon: "notifications", badge: "unread" },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  { label: "Analytics", href: "/analytics", icon: "analytics", badge: "none" },
  { label: "Settings", href: "/settings", icon: "settings", badge: "none" },
];

// ─── Icons ───────────────────────────────────────────────────────────────────

function DashboardIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function InboxIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function LeadsIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BellIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function SettingsIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function AnalyticsIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function getNavIcon(icon: NavItem["icon"], className: string) {
  switch (icon) {
    case "dashboard":
      return <DashboardIcon className={className} />;
    case "inbox":
      return <InboxIcon className={className} />;
    case "leads":
      return <LeadsIcon className={className} />;
    case "notifications":
      return <BellIcon className={className} />;
    case "settings":
      return <SettingsIcon className={className} />;
    case "analytics":
      return <AnalyticsIcon className={className} />;
    default:
      return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isActiveRoute(href: string, activePath: string): boolean {
  if (href === "/") {
    return activePath === "/";
  }
  return activePath.startsWith(href);
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Application sidebar navigation component.
 *
 * Features:
 * - Primary navigation links: Dashboard, Inbox, Leads, Notifications
 * - Secondary navigation links: Analytics, Settings
 * - Active route highlighting based on current path
 * - Unread notification count badge on Notifications link
 * - Collapsible sidebar with toggle button
 * - Responsive: hidden on mobile (< md), visible on desktop
 * - Accessible with ARIA attributes and keyboard navigation
 * - Stockland brand styling with green accent for active items
 *
 * Usage:
 * ```tsx
 * <Sidebar activePath="/" />
 * <Sidebar activePath="/inbox" className="border-r" />
 * ```
 */
export function Sidebar({ className = "", activePath = "/" }: SidebarProps) {
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const userEmail = session?.user?.email ?? undefined;

  const { unreadCount } = useNotifications({
    recipient: userEmail,
    enabled: Boolean(userEmail),
  });

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Close sidebar on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isCollapsed) {
        setIsCollapsed(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCollapsed]);

  const displayUnreadCount = unreadCount > 99 ? "99+" : String(unreadCount);

  const sidebarWidth = isCollapsed ? "w-16" : "w-60";

  return (
    <aside
      className={`hidden md:flex md:flex-col ${sidebarWidth} border-r border-gray-200 bg-white transition-all duration-200 ease-in-out ${className}`.trim()}
      role="navigation"
      aria-label="Sidebar navigation"
    >
      {/* Collapse Toggle */}
      <div className="flex items-center justify-end border-b border-gray-200 px-2 py-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-stockland-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3" aria-label="Primary navigation">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive = isActiveRoute(item.href, activePath);
          const showBadge = item.badge === "unread" && unreadCount > 0;

          return (
            <a
              key={item.href}
              href={item.href}
              className={`group relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 ${
                isActive
                  ? "bg-stockland-green/10 text-stockland-green"
                  : "text-gray-600 hover:bg-gray-100 hover:text-stockland-charcoal"
              } ${isCollapsed ? "justify-center" : "gap-3"}`}
              aria-current={isActive ? "page" : undefined}
              title={isCollapsed ? item.label : undefined}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-stockland-green"
                  aria-hidden="true"
                />
              )}

              <span className="relative flex-shrink-0">
                {getNavIcon(
                  item.icon,
                  `h-5 w-5 ${isActive ? "text-stockland-green" : "text-gray-400 group-hover:text-stockland-charcoal"}`
                )}
                {/* Badge on icon when collapsed */}
                {isCollapsed && showBadge && (
                  <span
                    className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
                    aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
                  >
                    {displayUnreadCount}
                  </span>
                )}
              </span>

              {!isCollapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {showBadge && (
                    <span
                      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold leading-none text-white"
                      aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
                    >
                      {displayUnreadCount}
                    </span>
                  )}
                </>
              )}
            </a>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-gray-200" aria-hidden="true" />

      {/* Secondary Navigation */}
      <nav className="space-y-1 px-2 py-3" aria-label="Secondary navigation">
        {SECONDARY_NAV_ITEMS.map((item) => {
          const isActive = isActiveRoute(item.href, activePath);

          return (
            <a
              key={item.href}
              href={item.href}
              className={`group relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 ${
                isActive
                  ? "bg-stockland-green/10 text-stockland-green"
                  : "text-gray-600 hover:bg-gray-100 hover:text-stockland-charcoal"
              } ${isCollapsed ? "justify-center" : "gap-3"}`}
              aria-current={isActive ? "page" : undefined}
              title={isCollapsed ? item.label : undefined}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-stockland-green"
                  aria-hidden="true"
                />
              )}

              {getNavIcon(
                item.icon,
                `h-5 w-5 flex-shrink-0 ${isActive ? "text-stockland-green" : "text-gray-400 group-hover:text-stockland-charcoal"}`
              )}

              {!isCollapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Bottom Section — Branding */}
      <div className="border-t border-gray-200 px-3 py-4">
        {isCollapsed ? (
          <div className="flex items-center justify-center">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-stockland-green"
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-stockland-green"
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-stockland-charcoal">
                Social DM Co-Pilot
              </p>
              <p className="truncate text-[10px] text-gray-400">
                v0.1.0
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;