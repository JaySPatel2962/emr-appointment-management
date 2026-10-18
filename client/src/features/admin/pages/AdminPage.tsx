import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import type { TabItem } from '@/components/ui/Tabs';
import { CreateDoctorForm } from '@/features/admin/components/CreateDoctorForm';
import { CreateReceptionistForm } from '@/features/admin/components/CreateReceptionistForm';
import { DoctorDirectory } from '@/features/admin/components/DoctorDirectory';
import { EditSchedulePanel } from '@/features/admin/components/EditSchedulePanel';
import { useDoctor } from '@/features/doctors/queries';

type AdminTab = 'schedules' | 'doctor' | 'receptionist';

const TABS: readonly TabItem<AdminTab>[] = [
  { value: 'schedules', label: 'Doctors and schedules' },
  { value: 'doctor', label: 'Add a doctor' },
  { value: 'receptionist', label: 'Add a receptionist' },
];

const parseTab = (value: string | null): AdminTab =>
  TABS.find((tab) => tab.value === value)?.value ?? 'schedules';

const SchedulesTab = ({
  doctorId,
  onEdit,
}: {
  doctorId: string | null;
  onEdit: (id: string) => void;
}) => {
  const { data: doctor } = useDoctor(doctorId);
  const editorRef = useRef<HTMLDivElement>(null);

  // Bring the editor into view when a doctor is chosen from the list.
  useEffect(() => {
    if (doctorId !== null) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [doctorId]);

  return (
    <div className="flex flex-col gap-6">
      <DoctorDirectory selectedId={doctorId} onEdit={onEdit} />
      <div ref={editorRef} className="scroll-mt-6">
        {doctor ? (
          <EditSchedulePanel key={doctor.id} doctor={doctor} />
        ) : (
          <p className="text-sm text-ink-muted">
            Choose "Edit schedule" for a doctor to change their days, hours, breaks and slot length.
          </p>
        )}
      </div>
    </div>
  );
};

export const AdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const doctorId = searchParams.get('doctor');

  const showTab = useCallback(
    (next: AdminTab) => setSearchParams({ tab: next }, { replace: true }),
    [setSearchParams],
  );
  const editDoctor = useCallback(
    (id: string) => setSearchParams({ tab: 'schedules', doctor: id }, { replace: true }),
    [setSearchParams],
  );

  return (
    <>
      <PageHeader
        title="Staff and schedules"
        description="Add doctors and receptionists, and set when each doctor works."
      />
      <Tabs label="Staff and schedules" items={TABS} value={tab} onChange={showTab}>
        {tab === 'schedules' ? <SchedulesTab doctorId={doctorId} onEdit={editDoctor} /> : null}
        {tab === 'doctor' ? (
          <CreateDoctorForm onCreated={(doctor) => editDoctor(doctor.id)} />
        ) : null}
        {tab === 'receptionist' ? <CreateReceptionistForm /> : null}
      </Tabs>
    </>
  );
};
