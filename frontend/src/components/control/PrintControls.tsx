import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, isConfirmationRequired } from '../../api/client';
import type { PrinterStatus } from '../../api/client';
import { Pause, Play, Square, Loader2 } from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

interface PrintControlsProps {
  printerId: number;
  status: PrinterStatus | null | undefined;
}

export function PrintControls({ printerId, status }: PrintControlsProps) {
  const queryClient = useQueryClient();
  const [confirmModal, setConfirmModal] = useState<{
    action: string;
    token: string;
    warning: string;
  } | null>(null);

  const isConnected = status?.connected ?? false;
  const isPrinting = status?.state === 'RUNNING';
  const isPaused = status?.state === 'PAUSE';

  const pauseMutation = useMutation({
    mutationFn: () => api.pausePrint(printerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printerStatuses'] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.resumePrint(printerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printerStatuses'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (token?: string) => api.stopPrint(printerId, token),
    onSuccess: (result) => {
      if (isConfirmationRequired(result)) {
        setConfirmModal({
          action: 'stop',
          token: result.token,
          warning: result.warning,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['printerStatuses'] });
      }
    },
  });

  const handleStop = () => {
    stopMutation.mutate(undefined);
  };

  const handleConfirmStop = () => {
    if (confirmModal) {
      stopMutation.mutate(confirmModal.token);
      setConfirmModal(null);
    }
  };

  const isLoading = pauseMutation.isPending || resumeMutation.isPending || stopMutation.isPending;

  return (
    <>
      <div className="bg-bambu-dark-secondary rounded-lg p-4">
        <h3 className="text-sm font-medium text-bambu-gray mb-3">Print Controls</h3>

        <div className="flex gap-2">
          {/* Pause Button */}
          <button
            onClick={() => pauseMutation.mutate()}
            disabled={!isConnected || !isPrinting || isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pauseMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Pause className="w-5 h-5" />
            )}
            <span className="font-medium">Pause</span>
          </button>

          {/* Resume Button */}
          <button
            onClick={() => resumeMutation.mutate()}
            disabled={!isConnected || !isPaused || isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-bambu-green/20 text-bambu-green hover:bg-bambu-green/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resumeMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            <span className="font-medium">Resume</span>
          </button>

          {/* Stop Button */}
          <button
            onClick={handleStop}
            disabled={!isConnected || (!isPrinting && !isPaused) || isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {stopMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Square className="w-5 h-5" />
            )}
            <span className="font-medium">Stop</span>
          </button>
        </div>

        {/* Error Message */}
        {(pauseMutation.error || resumeMutation.error || stopMutation.error) && (
          <p className="mt-2 text-sm text-red-400">
            {(pauseMutation.error || resumeMutation.error || stopMutation.error)?.message}
          </p>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          title="Confirm Stop"
          message={confirmModal.warning}
          confirmText="Stop Print"
          variant="danger"
          onConfirm={handleConfirmStop}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </>
  );
}
