export default function DashboardLoading() {
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

        {/* Three-Panel Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Inbox Skeleton */}
          <div className="w-80 flex-shrink-0 overflow-hidden border-r border-gray-200 bg-white lg:w-96">
            {/* Inbox Header */}
            <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-14 animate-pulse rounded bg-gray-200" />
                  <div className="h-5 w-8 animate-pulse rounded-full bg-gray-100" />
                </div>
                <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-200" />
              </div>
              {/* Search */}
              <div className="mt-2 h-8 w-full animate-pulse rounded-lg bg-gray-100" />
              {/* Filters */}
              <div className="mt-2 flex items-center gap-2">
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-gray-100" />
                <div className="h-8 flex-1 animate-pulse rounded-lg bg-gray-100" />
              </div>
            </div>

            {/* Inbox Items */}
            <div className="flex-1 overflow-y-auto">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex animate-pulse gap-3 border-b border-gray-100 px-4 py-3"
                >
                  <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-200" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-28 rounded bg-gray-200" />
                      <div className="h-3 w-12 rounded bg-gray-200" />
                    </div>
                    <div className="h-3 w-full rounded bg-gray-200" />
                    <div className="h-3 w-2/3 rounded bg-gray-200" />
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-12 rounded-full bg-gray-200" />
                      <div className="h-3 w-16 rounded bg-gray-200" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Center Panel: Draft Composer Skeleton */}
          <div className="flex flex-1 flex-col overflow-hidden border-r border-gray-200 bg-white">
            <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
              <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-gray-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-gray-300"
                  aria-hidden="true"
                >
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              </div>
              <div className="mt-4 space-y-2">
                <div className="mx-auto h-5 w-52 animate-pulse rounded bg-gray-200" />
                <div className="mx-auto h-4 w-72 animate-pulse rounded bg-gray-100" />
                <div className="mx-auto h-4 w-64 animate-pulse rounded bg-gray-100" />
              </div>
              <div className="mt-6 flex flex-col items-center gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200" />
                    <div
                      className="h-3 animate-pulse rounded bg-gray-200"
                      style={{ width: `${140 + i * 20}px` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Lead Capture Sidebar Skeleton */}
          <div className="hidden w-80 flex-shrink-0 overflow-y-auto bg-gray-50 p-4 lg:block xl:w-96">
            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-12 shadow-card">
              <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
              <div className="mt-3 h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="mt-1 h-3 w-40 animate-pulse rounded bg-gray-100" />
            </div>

            {/* Additional skeleton cards */}
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="mt-3 space-y-2.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 animate-pulse rounded bg-gray-200" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="h-3 w-12 animate-pulse rounded bg-gray-200" />
                        <div
                          className="h-3 animate-pulse rounded bg-gray-100"
                          style={{ width: `${60 + i * 20}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
                </div>
                <div className="mt-2 h-2 w-full animate-pulse rounded-full bg-gray-100" />
              </div>

              <div className="h-9 w-full animate-pulse rounded-lg bg-gray-200" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}