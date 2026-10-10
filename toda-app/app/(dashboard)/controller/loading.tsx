export default function ControllerLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Search skeleton */}
      <div className="space-y-1.5">
        <div className="h-3 w-24 bg-surface-subtle rounded-full animate-pulse" />
        <div className="h-14 bg-surface-subtle rounded-2xl animate-pulse" />
      </div>
      {/* Card skeleton */}
      <div className="h-20 bg-surface-subtle rounded-2xl animate-pulse" />
      {/* Buttons skeleton */}
      <div className="flex gap-2">
        <div className="flex-1 h-12 bg-surface-subtle rounded-full animate-pulse" />
        <div className="flex-1 h-12 bg-surface-subtle rounded-full animate-pulse" />
        <div className="flex-1 h-12 bg-surface-subtle rounded-full animate-pulse" />
      </div>
      <div className="h-14 bg-surface-subtle rounded-full animate-pulse" />
      {/* Feed skeleton */}
      <div className="space-y-3 mt-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 bg-surface-subtle rounded-2xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
