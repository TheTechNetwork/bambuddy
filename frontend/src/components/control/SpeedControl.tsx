import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { PrinterStatus } from '../../api/client';
import { Gauge, Loader2 } from 'lucide-react';

interface SpeedControlProps {
  printerId: number;
  status: PrinterStatus | null | undefined;
}

const SPEED_MODES = [
  { mode: 1, name: 'Silent', icon: '🔇' },
  { mode: 2, name: 'Standard', icon: '⚡' },
  { mode: 3, name: 'Sport', icon: '🚀' },
  { mode: 4, name: 'Ludicrous', icon: '💨' },
];

export function SpeedControl({ printerId, status }: SpeedControlProps) {
  const isConnected = status?.connected ?? false;
  const isPrinting = status?.state === 'RUNNING';

  // Note: Bambu printers don't report current speed mode via MQTT
  // So we can't show which mode is currently active

  const speedMutation = useMutation({
    mutationFn: (mode: number) => api.setPrintSpeed(printerId, mode),
  });

  return (
    <div className="bg-bambu-dark-secondary rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-4 h-4 text-bambu-gray" />
        <h3 className="text-sm font-medium">Print Speed</h3>
        {speedMutation.isPending && (
          <Loader2 className="w-4 h-4 animate-spin text-bambu-green" />
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {SPEED_MODES.map(({ mode, name, icon }) => (
          <button
            key={mode}
            onClick={() => speedMutation.mutate(mode)}
            disabled={!isConnected || !isPrinting || speedMutation.isPending}
            className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg transition-colors ${
              mode === 4
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-bambu-dark hover:bg-bambu-dark-tertiary'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={name}
          >
            <span className="text-lg">{icon}</span>
            <span className="text-xs">{name}</span>
          </button>
        ))}
      </div>

      {!isPrinting && (
        <p className="mt-3 text-xs text-bambu-gray text-center">
          Speed control only available during print
        </p>
      )}

      {speedMutation.error && (
        <p className="mt-2 text-sm text-red-400">
          {speedMutation.error.message}
        </p>
      )}
    </div>
  );
}
