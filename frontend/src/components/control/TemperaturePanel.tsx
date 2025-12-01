import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, isConfirmationRequired } from '../../api/client';
import type { PrinterStatus } from '../../api/client';
import { Thermometer, Loader2, Plus, Minus } from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

// Extended temperature interface for dual nozzle support
interface Temperatures {
  bed?: number;
  bed_target?: number;
  nozzle?: number;
  nozzle_target?: number;
  nozzle_2?: number;
  nozzle_2_target?: number;
  chamber?: number;
}

interface TemperaturePanelProps {
  printerId: number;
  status: PrinterStatus | null | undefined;
  nozzleCount: number;
}

interface TempPreset {
  name: string;
  bed: number;
  nozzle: number;
}

const PRESETS: TempPreset[] = [
  { name: 'Off', bed: 0, nozzle: 0 },
  { name: 'PLA', bed: 55, nozzle: 220 },
  { name: 'PETG', bed: 70, nozzle: 250 },
  { name: 'ABS', bed: 90, nozzle: 260 },
  { name: 'TPU', bed: 50, nozzle: 230 },
];

export function TemperaturePanel({ printerId, status, nozzleCount }: TemperaturePanelProps) {
  const [confirmModal, setConfirmModal] = useState<{
    type: 'bed' | 'nozzle';
    target: number;
    nozzle?: number;
    token: string;
    warning: string;
  } | null>(null);

  const isConnected = status?.connected ?? false;
  const temps = (status?.temperatures ?? {}) as Temperatures;

  const bedMutation = useMutation({
    mutationFn: ({ target, token }: { target: number; token?: string }) =>
      api.setBedTemperature(printerId, target, token),
    onSuccess: (result, variables) => {
      if (isConfirmationRequired(result)) {
        setConfirmModal({
          type: 'bed',
          target: variables.target,
          token: result.token,
          warning: result.warning,
        });
      }
    },
  });

  const nozzleMutation = useMutation({
    mutationFn: ({ target, nozzle, token }: { target: number; nozzle: number; token?: string }) =>
      api.setNozzleTemperature(printerId, target, nozzle, token),
    onSuccess: (result, variables) => {
      if (isConfirmationRequired(result)) {
        setConfirmModal({
          type: 'nozzle',
          target: variables.target,
          nozzle: variables.nozzle,
          token: result.token,
          warning: result.warning,
        });
      }
    },
  });

  const handleConfirm = () => {
    if (confirmModal) {
      if (confirmModal.type === 'bed') {
        bedMutation.mutate({ target: confirmModal.target, token: confirmModal.token });
      } else {
        nozzleMutation.mutate({
          target: confirmModal.target,
          nozzle: confirmModal.nozzle ?? 0,
          token: confirmModal.token,
        });
      }
      setConfirmModal(null);
    }
  };

  const handlePreset = (preset: TempPreset) => {
    bedMutation.mutate({ target: preset.bed });
    nozzleMutation.mutate({ target: preset.nozzle, nozzle: 0 });
    if (nozzleCount > 1) {
      nozzleMutation.mutate({ target: preset.nozzle, nozzle: 1 });
    }
  };

  const adjustTemp = (type: 'bed' | 'nozzle', delta: number, nozzle = 0) => {
    const currentTarget =
      type === 'bed'
        ? (temps.bed_target ?? 0)
        : nozzle === 0
        ? (temps.nozzle_target ?? 0)
        : (temps.nozzle_2_target ?? 0);
    const newTarget = Math.max(0, Math.min(type === 'bed' ? 120 : 300, currentTarget + delta));

    if (type === 'bed') {
      bedMutation.mutate({ target: newTarget });
    } else {
      nozzleMutation.mutate({ target: newTarget, nozzle });
    }
  };

  return (
    <>
      <div className="bg-bambu-dark-secondary rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Thermometer className="w-4 h-4 text-bambu-gray" />
          <h3 className="text-sm font-medium">Temperatures</h3>
        </div>

        {/* Presets */}
        <div className="flex gap-2 mb-4">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePreset(preset)}
              disabled={!isConnected}
              className="flex-1 px-2 py-1.5 text-xs rounded bg-bambu-dark-tertiary text-bambu-gray hover:bg-bambu-dark hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Bed Temperature */}
        <div className="mb-4 p-3 rounded bg-bambu-dark">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-bambu-gray">Bed</span>
            <span className="text-sm font-mono">
              <span className="text-orange-400">{Math.round(temps.bed ?? 0)}°C</span>
              <span className="text-bambu-gray mx-1">/</span>
              <span className="text-white">{Math.round(temps.bed_target ?? 0)}°C</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustTemp('bed', -5)}
              disabled={!isConnected || bedMutation.isPending}
              className="p-2 rounded bg-bambu-dark-secondary hover:bg-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 h-2 bg-bambu-dark-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all"
                style={{ width: `${Math.min(100, ((temps.bed ?? 0) / 120) * 100)}%` }}
              />
            </div>
            <button
              onClick={() => adjustTemp('bed', 5)}
              disabled={!isConnected || bedMutation.isPending}
              className="p-2 rounded bg-bambu-dark-secondary hover:bg-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
            {bedMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
        </div>

        {/* Nozzle Temperature(s) */}
        {[0, ...(nozzleCount > 1 ? [1] : [])].map((nozzle) => {
          const current = nozzle === 0 ? temps.nozzle : temps.nozzle_2;
          const target = nozzle === 0 ? temps.nozzle_target : temps.nozzle_2_target;

          return (
            <div key={nozzle} className="mb-4 p-3 rounded bg-bambu-dark">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-bambu-gray">
                  Nozzle {nozzleCount > 1 ? nozzle + 1 : ''}
                </span>
                <span className="text-sm font-mono">
                  <span className="text-red-400">{Math.round(current ?? 0)}°C</span>
                  <span className="text-bambu-gray mx-1">/</span>
                  <span className="text-white">{Math.round(target ?? 0)}°C</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustTemp('nozzle', -5, nozzle)}
                  disabled={!isConnected || nozzleMutation.isPending}
                  className="p-2 rounded bg-bambu-dark-secondary hover:bg-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 h-2 bg-bambu-dark-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${Math.min(100, ((current ?? 0) / 300) * 100)}%` }}
                  />
                </div>
                <button
                  onClick={() => adjustTemp('nozzle', 5, nozzle)}
                  disabled={!isConnected || nozzleMutation.isPending}
                  className="p-2 rounded bg-bambu-dark-secondary hover:bg-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {nozzleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </div>
          );
        })}

        {/* Chamber Temperature (read-only) */}
        {temps.chamber !== undefined && (
          <div className="p-3 rounded bg-bambu-dark">
            <div className="flex items-center justify-between">
              <span className="text-sm text-bambu-gray">Chamber</span>
              <span className="text-sm font-mono text-blue-400">{Math.round(temps.chamber)}°C</span>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          title="Confirm Temperature"
          message={confirmModal.warning}
          confirmText="Set Temperature"
          variant="warning"
          onConfirm={handleConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </>
  );
}
