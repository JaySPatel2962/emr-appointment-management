import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/feedback/toast-store';
import { createReceptionist } from '@/features/admin/api';
import { createDoctor, updateSchedule } from '@/features/doctors/api';
import type { UpdateScheduleBody } from '@/features/doctors/api';
import { doctorKeys } from '@/features/doctors/queries';
import { slotKeys } from '@/features/slots/queries';

export const useCreateReceptionist = () =>
  useMutation({
    mutationFn: createReceptionist,
    onSuccess: (user) => {
      toast.success(`${user.name} can now log in as a receptionist`);
    },
  });

export const useCreateDoctor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDoctor,
    onSuccess: (doctor) => {
      void queryClient.invalidateQueries({ queryKey: doctorKeys.lists() });
      toast.success(`${doctor.name} added. They can now log in.`);
    },
  });
};

/** Saving a schedule changes which slots exist, so every cached slot grid is refetched. */
export const useSaveSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateScheduleBody & { id: string }) => updateSchedule(id, body),
    onSuccess: (doctor) => {
      queryClient.setQueryData(doctorKeys.detail(doctor.id), doctor);
      void queryClient.invalidateQueries({ queryKey: doctorKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: slotKeys.all });
      toast.success(`Schedule saved for ${doctor.name}`);
    },
  });
};
