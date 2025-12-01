import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { PrinterStatus } from '../../api/client';
import { Fan, Loader2 } from 'lucide-react';

interface FanControlsProps {
  printerId: number;
  status: PrinterStatus | null | undefined;
}

interface FanSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  isLoading: boolean;
}

function FanSlider({ label, value, onChange, disabled, isLoading }: FanSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);

  const displayValue = isDragging ? localValue : value;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    setLocalValue(newValue);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  return (
    <div className="p-3 rounded bg-bambu-dark">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-bambu-gray">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-white">{displayValue}%</span>
          {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={displayValue}
        onChange={handleChange}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={handleMouseUp}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={handleMouseUp}
        disabled={disabled}
        className="w-full h-2 bg-bambu-dark-tertiary rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bambu-green [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-bambu-green [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
      />
      <div className="flex justify-between text-xs text-bambu-gray mt-1">
        <span>Off</span>
        <span>Max</span>
      </div>
    </div>
  );
}

export function FanControls({ printerId, status }: FanControlsProps) {
  const isConnected = status?.connected ?? false;

  // Note: Bambu printers don't report fan speeds via MQTT
  // So we track locally and can't show actual current values
  const [fanValues, setFanValues] = useState({
    part: 100,
    aux: 0,
    chamber: 0,
  });

  const partFanMutation = useMutation({
    mutationFn: (speed: number) => api.setPartFan(printerId, speed),
    onSuccess: (_, speed) => setFanValues((prev) => ({ ...prev, part: speed })),
  });

  const auxFanMutation = useMutation({
    mutationFn: (speed: number) => api.setAuxFan(printerId, speed),
    onSuccess: (_, speed) => setFanValues((prev) => ({ ...prev, aux: speed })),
  });

  const chamberFanMutation = useMutation({
    mutationFn: (speed: number) => api.setChamberFan(printerId, speed),
    onSuccess: (_, speed) => setFanValues((prev) => ({ ...prev, chamber: speed })),
  });

  return (
    <div className="bg-bambu-dark-secondary rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Fan className="w-4 h-4 text-bambu-gray" />
        <h3 className="text-sm font-medium">Fans</h3>
      </div>

      <div className="space-y-3">
        <FanSlider
          label="Part Cooling"
          value={fanValues.part}
          onChange={(v) => partFanMutation.mutate(v)}
          disabled={!isConnected}
          isLoading={partFanMutation.isPending}
        />
        <FanSlider
          label="Auxiliary"
          value={fanValues.aux}
          onChange={(v) => auxFanMutation.mutate(v)}
          disabled={!isConnected}
          isLoading={auxFanMutation.isPending}
        />
        <FanSlider
          label="Chamber"
          value={fanValues.chamber}
          onChange={(v) => chamberFanMutation.mutate(v)}
          disabled={!isConnected}
          isLoading={chamberFanMutation.isPending}
        />
      </div>

      {(partFanMutation.error || auxFanMutation.error || chamberFanMutation.error) && (
        <p className="mt-2 text-sm text-red-400">
          {(partFanMutation.error || auxFanMutation.error || chamberFanMutation.error)?.message}
        </p>
      )}
    </div>
  );
}
