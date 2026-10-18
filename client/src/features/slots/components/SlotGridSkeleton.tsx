import { Skeleton } from '@/components/ui/Skeleton';

/** The shape of a day sheet while its slots load. */
export const SlotGridSkeleton = () => (
  <div className="flex flex-col gap-3" role="status">
    <span className="sr-only">Loading the slots</span>
    <Skeleton className="h-4 w-40" />
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
      {Array.from({ length: 12 }, (_, index) => (
        <Skeleton key={index} className="h-16" />
      ))}
    </div>
  </div>
);
