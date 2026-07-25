import React from 'react';

export const CardSkeleton = () => (
  <div className="animate-pulse backdrop-blur-md bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
    <div className="h-12 w-12 rounded-xl bg-slate-800"></div>
    <div className="flex-1 space-y-2">
      <div className="h-6 w-16 bg-slate-800 rounded"></div>
      <div className="h-4 w-28 bg-slate-800 rounded"></div>
    </div>
  </div>
);

export const TableSkeleton = ({ rows = 4 }) => (
  <div className="animate-pulse space-y-3">
    <div className="h-10 w-full bg-slate-900/50 rounded-lg"></div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex justify-between items-center py-4 border-b border-slate-850 px-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-slate-800 rounded"></div>
          <div className="h-3 w-20 bg-slate-800 rounded"></div>
        </div>
        <div className="h-8 w-24 bg-slate-800 rounded-lg"></div>
      </div>
    ))}
  </div>
);

export const ChartSkeleton = () => (
  <div className="animate-pulse space-y-4 w-full">
    <div className="h-6 w-48 bg-slate-800 rounded"></div>
    <div className="h-64 bg-slate-900/20 border border-slate-800 rounded-2xl flex items-end justify-between p-6 gap-3">
      <div className="h-3/4 w-12 bg-slate-800 rounded-t"></div>
      <div className="h-1/2 w-12 bg-slate-800 rounded-t"></div>
      <div className="h-2/3 w-12 bg-slate-800 rounded-t"></div>
      <div className="h-4/5 w-12 bg-slate-800 rounded-t"></div>
    </div>
  </div>
);

export const CircleSkeleton = () => (
  <div className="animate-pulse flex flex-col items-center justify-center text-center p-6 bg-slate-900/30 border border-slate-800 rounded-2xl">
    <div className="h-6 w-36 bg-slate-800 rounded mb-6"></div>
    <div className="h-36 w-36 rounded-full bg-slate-900 border-8 border-slate-800 flex items-center justify-center">
      <div className="h-10 w-16 bg-slate-800 rounded"></div>
    </div>
    <div className="mt-8 flex justify-between w-full gap-4">
      <div className="h-8 w-20 bg-slate-800 rounded"></div>
      <div className="h-8 w-20 bg-slate-800 rounded"></div>
      <div className="h-8 w-20 bg-slate-800 rounded"></div>
    </div>
  </div>
);

export const DashboardSkeleton = () => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <CircleSkeleton />
      <div className="lg:col-span-2">
        <ChartSkeleton />
      </div>
    </div>
    <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
      <TableSkeleton />
    </div>
  </div>
);
