import React from 'react';

const Skeleton = ({ className = '', style, ...props }) => (
  <div
    className={`animate-pulse bg-slate-800 rounded ${className}`}
    style={style}
    {...props}
    aria-hidden="true"
  />
);

Skeleton.displayName = 'Skeleton';

export const CardSkeleton = () => (
  <div className="animate-pulse backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
    <Skeleton className="h-12 w-12 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-6 w-16 rounded" />
      <Skeleton className="h-4 w-28 rounded" />
    </div>
  </div>
);

export const TableSkeleton = ({ rows = 4, columns = 4 }) => (
  <div className="animate-pulse space-y-3">
    <div className="flex gap-4 px-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-10 flex-1 rounded-lg" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 px-4 py-4 border-b border-slate-850">
        {Array.from({ length: columns }).map((_, j) => (
          <Skeleton key={j} className={`h-4 ${j === 0 ? 'w-32' : 'w-20'} rounded`} />
        ))}
      </div>
    ))}
  </div>
);

export const ChartSkeleton = () => (
  <div className="animate-pulse space-y-4 w-full">
    <Skeleton className="h-6 w-48 rounded" />
    <div className="h-64 bg-slate-900/20 border border-slate-800 rounded-2xl flex items-end justify-between p-6 gap-3">
      {[70, 45, 80, 55, 90, 65, 75].map((height, i) => (
        <Skeleton key={i} className={`w-12 rounded-t`} style={{ height: `${height}%` }} />
      ))}
    </div>
  </div>
);

export const CircleSkeleton = () => (
  <div className="animate-pulse flex flex-col items-center justify-center text-center p-6 bg-slate-900/30 border border-slate-800 rounded-2xl">
    <Skeleton className="h-6 w-36 rounded mb-6" />
    <div className="h-36 w-36 rounded-full bg-slate-900 border-8 border-slate-800 flex items-center justify-center">
      <Skeleton className="h-10 w-16 rounded" />
    </div>
    <div className="mt-8 flex justify-between w-full gap-4">
      <Skeleton className="h-8 w-20 rounded" />
      <Skeleton className="h-8 w-20 rounded" />
      <Skeleton className="h-8 w-20 rounded" />
    </div>
  </div>
);

export const StatCardSkeleton = () => (
  <div className="animate-pulse backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-24 rounded" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
    <Skeleton className="h-12 w-20 rounded mt-4" />
    <Skeleton className="h-4 w-16 rounded mt-2" />
  </div>
);

export const ListSkeleton = ({ items = 5 }) => (
  <div className="animate-pulse space-y-3">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    ))}
  </div>
);

export const FormSkeleton = ({ fields = 4 }) => (
  <div className="animate-pulse space-y-6">
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    ))}
  </div>
);

export const DashboardSkeleton = () => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <CircleSkeleton />
      <div className="lg:col-span-2">
        <ChartSkeleton />
      </div>
    </div>
    <div className="backdrop-blur-md bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
      <TableSkeleton rows={5} columns={4} />
    </div>
  </div>
);

export default Skeleton;