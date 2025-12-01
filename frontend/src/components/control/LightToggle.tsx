import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { PrinterStatus } from '../../api/client';
import { Lightbulb, LightbulbOff, Loader2 } from 'lucide-react';

interface LightToggleProps {
  printerId: number;
  status: PrinterStatus | null | undefined;
}

export function LightToggle({ printerId, status }: LightToggleProps) {
  const isConnected = status?.connected ?? false;

  // Note: Bambu printers don't report light state via standard MQTT
  // Track locally
  const [isOn, setIsOn] = useState(true);

  const lightMutation = useMutation({
    mutationFn: (on: boolean) => api.setChamberLight(printerId, on),
    onSuccess: (_, on) => setIsOn(on),
  });

  const handleToggle = () => {
    lightMutation.mutate(!isOn);
  };

  return (
    <div className="bg-bambu-dark-secondary rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOn ? (
            <Lightbulb className="w-4 h-4 text-yellow-400" />
          ) : (
            <LightbulbOff className="w-4 h-4 text-bambu-gray" />
          )}
          <h3 className="text-sm font-medium">Chamber Light</h3>
        </div>

        <button
          onClick={handleToggle}
          disabled={!isConnected || lightMutation.isPending}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            isOn ? 'bg-bambu-green' : 'bg-bambu-dark-tertiary'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {lightMutation.isPending ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                isOn ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          )}
        </button>
      </div>

      {lightMutation.error && (
        <p className="mt-2 text-sm text-red-400">
          {lightMutation.error.message}
        </p>
      )}
    </div>
  );
}
