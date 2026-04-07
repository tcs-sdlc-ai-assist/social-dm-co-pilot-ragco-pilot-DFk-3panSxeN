"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useNotifications } from "@/hooks/useNotifications";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HeaderProps {
  /** Optional additional CSS classes */
  className?: string;
}

// ─── Navigation Links ────────────────────────────────────────────────────────

interface NavLink {
  label: string;
  href: string;
  icon: "inbox" | "notifications" | "leads" | "dashboard";
}

const NAV_LINKS: NavLink[] = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Inbox", href: "/inbox", icon: "inbox" },
  { label: "Leads", href: "/leads", icon: "leads" },
  { label: "Notifications", href: "/notifications", icon: "notifications" },
];

// ─── Icons ───────────────────────────────────────────────────────────────────

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

function ChevronDownIcon({ className }: { className: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MenuIcon({ className }: { className: string }) {
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
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function CloseIcon({ className }: { className: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function LogOutIcon({ className }: { className: string }) {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function getNavIcon(icon: NavLink["icon"], className: string) {
  switch (icon) {
    case "inbox":
      return <InboxIcon className={className} />;
    case "notifications":
      return <BellIcon className={className} />;
    case "leads":
      return <LeadsIcon className={className} />;
    case "dashboard":
      return <DashboardIcon className={className} />;
    default:
      return null;
  }
}

// ─── User Avatar ─────────────────────────────────────────────────────────────

function UserAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  const sizeClasses = size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-stockland-green text-white font-medium ${sizeClasses}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Application header with Stockland branding, navigation links,
 * user info from session, and notification bell icon with unread count badge.
 *
 * Features:
 * - Stockland logo and brand name
 * - Navigation links: Dashboard, Inbox, Leads, Notifications
 * - Notification bell with unread count badge
 * - User dropdown menu with name, email, role, and sign out
 * - Responsive: collapses to hamburger menu on mobile
 * - Accessible with ARIA attributes and keyboard navigation
 *
 * Usage:
 * ```tsx
 * <Header />
 * ```
 */
export function Header({ className = "" }: HeaderProps) {
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);

  const userEmail = session?.user?.email ?? undefined;
  const userName = session?.user?.name ?? "Agent";
  const userRole = (session?.user as { role?: string } | undefined)?.role ?? "agent";

  const { unreadCount } = useNotifications({
    recipient: userEmail,
    enabled: Boolean(userEmail),
  });

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node) &&
        userMenuButtonRef.current &&
        !userMenuButtonRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }

    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isUserMenuOpen]);

  // Close user menu on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const toggleUserMenu = useCallback(() => {
    setIsUserMenuOpen((prev) => !prev);
  }, []);

  const handleSignOut = useCallback(() => {
    setIsUserMenuOpen(false);
    void signOut({ callbackUrl: "/auth/signin" });
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const displayUnreadCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b border-gray-200 bg-white ${className}`.trim()}
      role="banner"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-2"
              aria-label="Social DM Co-Pilot — Home"
            >
              {/* Stockland Logo Mark */}
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-stockland-green"
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
                  className="h-5 w-5"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </span>
              <div className="hidden sm:block">
                <span className="text-base font-semibold text-stockland-charcoal">
                  Social DM
                </span>
                <span className="ml-1 text-base font-semibold text-stockland-green">
                  Co-Pilot
                </span>
              </div>
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex md:items-center md:gap-1" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-stockland-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
              >
                {getNavIcon(link.icon, "h-4 w-4")}
                <span>{link.label}</span>
                {link.icon === "notifications" && unreadCount > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
                    aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
                  >
                    {displayUnreadCount}
                  </span>
                )}
              </a>
            ))}
          </nav>

          {/* Right Section: Notification Bell + User Menu */}
          <div className="flex items-center gap-2">
            {/* Notification Bell (visible on all sizes) */}
            <a
              href="/notifications"
              className="relative inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-stockland-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 md:hidden"
              aria-label={
                unreadCount > 0
                  ? `Notifications — ${unreadCount} unread`
                  : "Notifications"
              }
            >
              <BellIcon className="h-5 w-5" />
              {unreadCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
                  aria-hidden="true"
                >
                  {displayUnreadCount}
                </span>
              )}
            </a>

            {/* Desktop Notification Bell */}
            <a
              href="/notifications"
              className="relative hidden items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-stockland-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 md:inline-flex"
              aria-label={
                unreadCount > 0
                  ? `Notifications — ${unreadCount} unread`
                  : "Notifications"
              }
            >
              <BellIcon className="h-5 w-5" />
              {unreadCount > 0 && (
                <span
                  className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
                  aria-hidden="true"
                >
                  {displayUnreadCount}
                </span>
              )}
            </a>

            {/* User Menu (Desktop) */}
            <div className="relative hidden md:block">
              <button
                ref={userMenuButtonRef}
                type="button"
                onClick={toggleUserMenu}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
                aria-label="User menu"
              >
                <UserAvatar name={userName} />
                <span className="hidden max-w-[120px] truncate font-medium lg:block">
                  {userName}
                </span>
                <ChevronDownIcon
                  className={`h-4 w-4 text-gray-400 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div
                  ref={userMenuRef}
                  className="absolute right-0 mt-1 w-56 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                  role="menu"
                  aria-orientation="vertical"
                  aria-label="User menu"
                >
                  {/* User Info */}
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-medium text-stockland-charcoal">
                      {userName}
                    </p>
                    {userEmail && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {userEmail}
                      </p>
                    )}
                    <span className="mt-1.5 inline-flex items-center rounded-full bg-stockland-green/10 px-2 py-0.5 text-xs font-medium capitalize text-stockland-green">
                      {userRole}
                    </span>
                  </div>

                  {/* Sign Out */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stockland-green"
                      role="menuitem"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-stockland-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1 md:hidden"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? (
                <CloseIcon className="h-5 w-5" />
              ) : (
                <MenuIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white md:hidden" role="navigation" aria-label="Mobile navigation">
          <div className="space-y-1 px-4 pb-3 pt-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className="relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-stockland-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
              >
                {getNavIcon(link.icon, "h-4.5 w-4.5")}
                <span>{link.label}</span>
                {link.icon === "notifications" && unreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold leading-none text-white">
                    {displayUnreadCount}
                  </span>
                )}
              </a>
            ))}
          </div>

          {/* Mobile User Section */}
          <div className="border-t border-gray-200 px-4 pb-4 pt-3">
            <div className="flex items-center gap-3">
              <UserAvatar name={userName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stockland-charcoal">
                  {userName}
                </p>
                {userEmail && (
                  <p className="truncate text-xs text-gray-500">{userEmail}</p>
                )}
              </div>
              <span className="inline-flex items-center rounded-full bg-stockland-green/10 px-2 py-0.5 text-xs font-medium capitalize text-stockland-green">
                {userRole}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stockland-green focus-visible:ring-offset-1"
            >
              <LogOutIcon className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;