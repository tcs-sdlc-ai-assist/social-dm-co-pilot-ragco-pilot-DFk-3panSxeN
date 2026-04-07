export default function NotificationsLoading() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
              <div className="hidden sm:block">
                <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
            <div className="hidden md:flex md:items-center md:gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-24 animate-pulse rounded-lg bg-gray-200"
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
              <div className="hidden md:flex md:items-center md:gap-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                <div className="hidden h-4 w-20 animate-pulse rounded bg-gray-200 lg:block" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Skeleton */}
        <aside className="hidden w-60 flex-col border-r border-gray-200 bg-white md:flex">
          <div className="flex items-center justify-end border-b border-gray-200 px-2 py-3">
            <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-200" />
          </div>
          <nav className="flex-1 space-y-1 px-2 py-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              >
                <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                <div
                  className="h-4 animate-pulse rounded bg-gray-200"
                  style={{ width: `${60 + i * 15}px` }}
                />
              </div>
            ))}
          </nav>
          <div className="mx-3 border-t border-gray-200" />
          <nav className="space-y-1 px-2 py-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              >
                <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                <div
                  className="h-4 animate-pulse rounded bg-gray-200"
                  style={{ width: `${70 + i * 10}px` }}
                />
              </div>
            ))}
          </nav>
          <div className="border-t border-gray-200 px-3 py-4">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-200" />
              <div className="min-w-0 space-y-1">
                <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
                <div className="h-2 w-12 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          </div>
        </aside>

        {/* Notification Center Skeleton */}
        <div className="flex flex-1 flex-col overflow-hidden bg-white">
          {/* Notification Header */}
          <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-8 animate-pulse rounded-full bg-gray-100" />
                <div className="h-5 w-14 animate-pulse rounded-full bg-blue-100" />
              </div>
              <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-200" />
            </div>

            {/* Filter Dropdowns */}
            <div className="mt-2 flex items-center gap-2">
              <div className="h-8 flex-1 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-8 flex-1 animate-pulse rounded-lg bg-gray-100" />
            </div>

            {/* Mark All as Read */}
            <div className="mt-2 flex items-center justify-end">
              <div className="h-7 w-32 animate-pulse rounded-lg bg-gray-100" />
            </div>
          </div>

          {/* Notification Items Skeleton */}
          <div className="flex-1 overflow-y-auto">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse gap-3 border-b border-gray-100 px-4 py-3"
              >
                {/* Unread dot placeholder */}
                <div className="mt-1.5 flex-shrink-0">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      i < 3 ? "bg-blue-200" : "bg-transparent"
                    }`}
                  />
                </div>

                {/* Type icon */}
                <div
                  className={`h-9 w-9 flex-shrink-0 rounded-full ${
                    i === 0
                      ? "bg-red-100"
                      : i === 1
                        ? "bg-orange-100"
                        : i === 2
                          ? "bg-blue-100"
                          : i === 3
                            ? "bg-emerald-100"
                            : i === 4
                              ? "bg-yellow-100"
                              : i === 5
                                ? "bg-purple-100"
                                : "bg-gray-100"
                  }`}
                />

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-2">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-3 animate-pulse rounded bg-gray-200"
                        style={{ width: `${80 + i * 10}px` }}
                      />
                      {i < 2 && (
                        <div className="h-4 w-14 animate-pulse rounded-full bg-red-100" />
                      )}
                    </div>
                    <div className="h-3 w-12 animate-pulse rounded bg-gray-200" />
                  </div>

                  {/* Details text */}
                  <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
                  <div
                    className="h-3 animate-pulse rounded bg-gray-200"
                    style={{ width: `${50 + i * 5}%` }}
                  />

                  {/* Footer row: status badge + related info */}
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-14 animate-pulse rounded-full bg-gray-200" />
                    <div
                      className="h-3 animate-pulse rounded bg-gray-200"
                      style={{ width: `${100 + i * 12}px` }}
                    />
                  </div>
                </div>

                {/* Action buttons placeholder */}
                <div className="flex flex-shrink-0 flex-col items-center gap-1">
                  <div className="h-5 w-5 animate-pulse rounded bg-gray-100" />
                  <div className="h-5 w-5 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>

          {/* Footer Skeleton */}
          <div className="flex-shrink-0 border-t border-gray-200 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}