import mongoose from 'mongoose';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSeconds: number;
  timestamp: string;
}

export const getHealthStatus = (): HealthStatus => {
  const databaseUp = mongoose.connection.readyState === mongoose.STATES.connected;
  return {
    status: databaseUp ? 'ok' : 'degraded',
    database: databaseUp ? 'up' : 'down',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
};
