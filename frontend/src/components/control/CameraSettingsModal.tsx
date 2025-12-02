import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { PrinterStatus } from '../../api/client';
import { X, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../Card';

interface CameraSettingsModalProps {
  printerId: number;
  status: PrinterStatus | null | undefined;
  onClose: () => void;
}

export function CameraSettingsModal({ printerId, status, onClose }: CameraSettingsModalProps) {
  const queryClient = useQueryClient();
  const isConnected = status?.connected ?? false;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const timelapseMutation = useMutation({
    mutationFn: (enable: boolean) => api.setTimelapse(printerId, enable),
    onSuccess: (data) => {
      console.log('Timelapse mutation success:', data);
      queryClient.invalidateQueries({ queryKey: ['printerStatuses'] });
    },
    onError: (error) => {
      console.error('Timelapse mutation error:', error);
    },
  });

  const liveviewMutation = useMutation({
    mutationFn: (enable: boolean) => api.setLiveview(printerId, enable),
    onSuccess: (data) => {
      console.log('Liveview mutation success:', data);
      queryClient.invalidateQueries({ queryKey: ['printerStatuses'] });
    },
    onError: (error) => {
      console.error('Liveview mutation error:', error);
    },
  });

  console.log('CameraSettingsModal render - isConnected:', isConnected, 'status:', status);

  const handleTimelapseToggle = () => {
    console.log('Timelapse toggle clicked, current:', status?.timelapse, 'setting to:', !status?.timelapse);
    timelapseMutation.mutate(!status?.timelapse);
  };

  const handleLiveviewToggle = () => {
    console.log('Liveview toggle clicked, current:', status?.ipcam, 'setting to:', !status?.ipcam);
    liveviewMutation.mutate(!status?.ipcam);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-sm" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-bambu-dark-tertiary">
            <span className="text-sm font-medium text-white">Camera Settings</span>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-bambu-dark-tertiary text-bambu-gray hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Settings */}
          <div className="p-4 space-y-4">
            {/* Auto-record Monitoring (ipcam_record - records to SD during print) */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">Auto-record Monitoring</span>
              <button
                onClick={handleLiveviewToggle}
                disabled={!isConnected || liveviewMutation.isPending}
                className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  status?.ipcam ? 'bg-bambu-green' : 'bg-bambu-dark-tertiary'
                }`}
              >
                {liveviewMutation.isPending ? (
                  <Loader2 className="absolute inset-0 m-auto w-4 h-4 animate-spin text-white" />
                ) : (
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      status?.ipcam ? 'left-7' : 'left-1'
                    }`}
                  />
                )}
              </button>
            </div>

            {/* Go Live (timelapse - live streaming) */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">Go Live</span>
              <button
                onClick={handleTimelapseToggle}
                disabled={!isConnected || timelapseMutation.isPending}
                className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  status?.timelapse ? 'bg-bambu-green' : 'bg-bambu-dark-tertiary'
                }`}
              >
                {timelapseMutation.isPending ? (
                  <Loader2 className="absolute inset-0 m-auto w-4 h-4 animate-spin text-white" />
                ) : (
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      status?.timelapse ? 'left-7' : 'left-1'
                    }`}
                  />
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
