import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, isConfirmationRequired } from '../../api/client';
import type { PrinterStatus } from '../../api/client';
import { Home, Move, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Power } from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

interface MovementControlsProps {
  printerId: number;
  status: PrinterStatus | null | undefined;
}

export function MovementControls({ printerId, status }: MovementControlsProps) {
  const isConnected = status?.connected ?? false;
  const isPrinting = status?.state === 'RUNNING' || status?.state === 'PAUSE';

  const [confirmModal, setConfirmModal] = useState<{
    action: string;
    token: string;
    warning: string;
    onConfirm: () => void;
  } | null>(null);

  const [moveDistance, setMoveDistance] = useState(10);

  const homeMutation = useMutation({
    mutationFn: ({ axes, token }: { axes: string; token?: string }) =>
      api.homeAxes(printerId, axes, token),
    onSuccess: (result) => {
      if (isConfirmationRequired(result)) {
        setConfirmModal({
          action: 'home',
          token: result.token,
          warning: result.warning,
          onConfirm: () => homeMutation.mutate({ axes: 'XYZ', token: result.token }),
        });
      }
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ axis, distance, token }: { axis: string; distance: number; token?: string }) =>
      api.moveAxis(printerId, axis, distance, 3000, token),
    onSuccess: (result, variables) => {
      if (isConfirmationRequired(result)) {
        setConfirmModal({
          action: 'move',
          token: result.token,
          warning: result.warning,
          onConfirm: () =>
            moveMutation.mutate({
              axis: variables.axis,
              distance: variables.distance,
              token: result.token,
            }),
        });
      }
    },
  });

  const disableMotorsMutation = useMutation({
    mutationFn: (token?: string) => api.disableMotors(printerId, token),
    onSuccess: (result) => {
      if (isConfirmationRequired(result)) {
        setConfirmModal({
          action: 'disable',
          token: result.token,
          warning: result.warning,
          onConfirm: () => disableMotorsMutation.mutate(result.token),
        });
      }
    },
  });

  const handleHome = () => {
    homeMutation.mutate({ axes: 'XYZ' });
  };

  const handleMove = (axis: string, distance: number) => {
    moveMutation.mutate({ axis, distance });
  };

  const handleDisableMotors = () => {
    disableMotorsMutation.mutate(undefined);
  };

  const handleConfirm = () => {
    if (confirmModal) {
      confirmModal.onConfirm();
      setConfirmModal(null);
    }
  };

  const isLoading =
    homeMutation.isPending || moveMutation.isPending || disableMotorsMutation.isPending;

  return (
    <>
      <div className="bg-bambu-dark-secondary rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-bambu-gray" />
            <h3 className="text-sm font-medium">Movement</h3>
          </div>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-bambu-green" />}
        </div>

        {isPrinting && (
          <div className="mb-4 p-2 rounded bg-yellow-500/20 text-yellow-500 text-xs text-center">
            Movement is restricted during printing
          </div>
        )}

        {/* Distance Selector */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-xs text-bambu-gray">Distance:</span>
          {[1, 10, 50].map((d) => (
            <button
              key={d}
              onClick={() => setMoveDistance(d)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                moveDistance === d
                  ? 'bg-bambu-green text-white'
                  : 'bg-bambu-dark-tertiary text-bambu-gray hover:bg-bambu-dark hover:text-white'
              }`}
            >
              {d}mm
            </button>
          ))}
        </div>

        {/* Movement Grid */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {/* Row 1: Y+ */}
          <div />
          <div />
          <button
            onClick={() => handleMove('Y', moveDistance)}
            disabled={!isConnected || isLoading}
            className="p-3 rounded bg-bambu-dark hover:bg-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Y+${moveDistance}`}
          >
            <ChevronUp className="w-5 h-5 mx-auto" />
          </button>
          <div />
          <button
            onClick={() => handleMove('Z', moveDistance)}
            disabled={!isConnected || isLoading}
            className="p-3 rounded bg-bambu-dark hover:bg-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Z+${moveDistance}`}
          >
            <ChevronUp className="w-5 h-5 mx-auto text-blue-400" />
          </button>

          {/* Row 2: X-, Home, X+ */}
          <div />
          <button
            onClick={() => handleMove('X', -moveDistance)}
            disabled={!isConnected || isLoading}
            className="p-3 rounded bg-bambu-dark hover:bg-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
            title={`X-${moveDistance}`}
          >
            <ChevronLeft className="w-5 h-5 mx-auto" />
          </button>
          <button
            onClick={handleHome}
            disabled={!isConnected || isLoading}
            className="p-3 rounded bg-bambu-green/20 text-bambu-green hover:bg-bambu-green/30 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Home all axes"
          >
            <Home className="w-5 h-5 mx-auto" />
          </button>
          <button
            onClick={() => handleMove('X', moveDistance)}
            disabled={!isConnected || isLoading}
            className="p-3 rounded bg-bambu-dark hover:bg-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
            title={`X+${moveDistance}`}
          >
            <ChevronRight className="w-5 h-5 mx-auto" />
          </button>
          <div className="text-center text-xs text-bambu-gray self-center">Z</div>

          {/* Row 3: Y- */}
          <div />
          <div />
          <button
            onClick={() => handleMove('Y', -moveDistance)}
            disabled={!isConnected || isLoading}
            className="p-3 rounded bg-bambu-dark hover:bg-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Y-${moveDistance}`}
          >
            <ChevronDown className="w-5 h-5 mx-auto" />
          </button>
          <div />
          <button
            onClick={() => handleMove('Z', -moveDistance)}
            disabled={!isConnected || isLoading}
            className="p-3 rounded bg-bambu-dark hover:bg-bambu-dark-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Z-${moveDistance}`}
          >
            <ChevronDown className="w-5 h-5 mx-auto text-blue-400" />
          </button>
        </div>

        {/* Disable Motors */}
        <button
          onClick={handleDisableMotors}
          disabled={!isConnected || isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-bambu-dark hover:bg-bambu-dark-tertiary text-bambu-gray hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Power className="w-4 h-4" />
          <span className="text-sm">Disable Motors</span>
        </button>

        {(homeMutation.error || moveMutation.error || disableMotorsMutation.error) && (
          <p className="mt-2 text-sm text-red-400">
            {(homeMutation.error || moveMutation.error || disableMotorsMutation.error)?.message}
          </p>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          title="Confirm Action"
          message={confirmModal.warning}
          confirmText="Continue"
          variant="warning"
          onConfirm={handleConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </>
  );
}
