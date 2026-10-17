/** Super Admins' room: every scheduler change is sent here as well. */
export const ADMIN_ROOM = 'admin';

/** Everyone viewing one doctor's scheduler for one date. */
export const schedulerRoom = (doctorId: string, date: string): string =>
  `scheduler:${doctorId}:${date}`;
