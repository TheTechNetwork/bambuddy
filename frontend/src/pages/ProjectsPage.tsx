import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban,
  Loader2,
  Plus,
  Trash2,
  Edit3,
  Archive,
  ListTodo,
  Package,
} from 'lucide-react';
import { api } from '../api/client';
import type { ProjectListItem, ProjectCreate, ProjectUpdate } from '../api/client';
import { Card, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../contexts/ToastContext';

const PROJECT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
];

interface ProjectModalProps {
  project?: ProjectListItem;
  onClose: () => void;
  onSave: (data: ProjectCreate | ProjectUpdate) => void;
  isLoading: boolean;
}

function ProjectModal({ project, onClose, onSave, isLoading }: ProjectModalProps) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[0]);
  const [targetCount, setTargetCount] = useState(project?.target_count?.toString() || '');
  const [status, setStatus] = useState(project?.status || 'active');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      target_count: targetCount ? parseInt(targetCount, 10) : undefined,
      ...(project && { status }),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-bambu-dark-secondary rounded-lg w-full max-w-md border border-bambu-dark-tertiary">
        <div className="p-4 border-b border-bambu-dark-tertiary">
          <h2 className="text-lg font-semibold text-white">
            {project ? 'Edit Project' : 'New Project'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bambu-dark border border-bambu-dark-tertiary rounded px-3 py-2 text-white placeholder-bambu-gray focus:outline-none focus:border-bambu-green"
              placeholder="e.g., Voron 2.4 Build"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-bambu-dark border border-bambu-dark-tertiary rounded px-3 py-2 text-white placeholder-bambu-gray focus:outline-none focus:border-bambu-green resize-none"
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-bambu-dark-secondary scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Target Print Count (optional)
            </label>
            <input
              type="number"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              className="w-full bg-bambu-dark border border-bambu-dark-tertiary rounded px-3 py-2 text-white placeholder-bambu-gray focus:outline-none focus:border-bambu-green"
              placeholder="e.g., 50 parts to print"
              min="1"
            />
          </div>

          {project && (
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-bambu-dark border border-bambu-dark-tertiary rounded px-3 py-2 text-white focus:outline-none focus:border-bambu-green"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : project ? (
                'Save'
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectListItem;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ProjectCard({ project, onClick, onEdit, onDelete }: ProjectCardProps) {
  const progressPercent = project.progress_percent ?? 0;
  const isCompleted = project.status === 'completed';
  const isArchived = project.status === 'archived';

  return (
    <Card className="hover:border-bambu-gray/30 transition-colors cursor-pointer" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color || '#6b7280' }}
            />
            <div>
              <h3 className="font-medium text-white">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-bambu-gray/70 mt-0.5 line-clamp-1">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isCompleted && (
              <span className="text-xs bg-bambu-green/20 text-bambu-green px-2 py-0.5 rounded">
                Completed
              </span>
            )}
            {isArchived && (
              <span className="text-xs bg-bambu-gray/20 text-bambu-gray px-2 py-0.5 rounded">
                Archived
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={onEdit} className="p-1">
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="p-1 text-red-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {project.target_count && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-bambu-gray mb-1">
              <span>{project.archive_count} / {project.target_count} prints</span>
              <span>{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-bambu-dark rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.min(progressPercent, 100)}%`,
                  backgroundColor: progressPercent >= 100 ? '#22c55e' : project.color || '#6b7280',
                }}
              />
            </div>
          </div>
        )}

        {/* Archive thumbnails */}
        {project.archives && project.archives.length > 0 && (
          <div className="mb-3">
            <div className="flex gap-2">
              {project.archives.slice(0, 5).map((archive) => (
                <a
                  key={archive.id}
                  href={`/archives?search=${encodeURIComponent(archive.print_name || '')}`}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-14 h-14 rounded-lg bg-bambu-dark flex-shrink-0 overflow-hidden border border-bambu-dark-tertiary hover:border-bambu-green transition-colors"
                  title={archive.print_name || 'Unknown'}
                >
                  {archive.thumbnail_path ? (
                    <img
                      src={`/api/v1/archives/${archive.id}/thumbnail`}
                      alt={archive.print_name || ''}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-bambu-gray">
                      <Package className="w-6 h-6" />
                    </div>
                  )}
                  {archive.status === 'failed' && (
                    <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✗</span>
                    </div>
                  )}
                </a>
              ))}
              {project.archive_count > 5 && (
                <div className="w-14 h-14 rounded-lg bg-bambu-dark flex-shrink-0 flex items-center justify-center text-sm text-bambu-gray border border-bambu-dark-tertiary">
                  +{project.archive_count - 5}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-bambu-gray">
          <div className="flex items-center gap-1" title="Archives">
            <Archive className="w-4 h-4" />
            <span>{project.archive_count}</span>
          </div>
          <div className="flex items-center gap-1" title="Queued">
            <ListTodo className="w-4 h-4" />
            <span>{project.queue_count}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectListItem | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', statusFilter === 'all' ? undefined : statusFilter],
    queryFn: () => api.getProjects(statusFilter === 'all' ? undefined : statusFilter),
  });

  const createMutation = useMutation({
    mutationFn: (data: ProjectCreate) => api.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowModal(false);
      showToast('Project created', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message, 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProjectUpdate }) =>
      api.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowModal(false);
      setEditingProject(undefined);
      showToast('Project updated', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeleteConfirm(null);
      showToast('Project deleted', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message, 'error');
    },
  });

  const handleSave = (data: ProjectCreate | ProjectUpdate) => {
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data });
    } else {
      createMutation.mutate(data as ProjectCreate);
    }
  };

  const handleEdit = (project: ProjectListItem) => {
    setEditingProject(project);
    setShowModal(true);
  };

  const handleClick = (project: ProjectListItem) => {
    // Open edit modal when clicking on card
    handleEdit(project);
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirm(id);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm !== null) {
      deleteMutation.mutate(deleteConfirm);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderKanban className="w-6 h-6 text-bambu-green" />
          <h1 className="text-2xl font-bold text-white">Projects</h1>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['active', 'completed', 'archived', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              statusFilter === status
                ? 'bg-bambu-green text-white'
                : 'bg-bambu-card text-bambu-gray hover:bg-bambu-gray/20'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-bambu-green" />
        </div>
      ) : projects?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderKanban className="w-12 h-12 text-bambu-gray/50 mx-auto mb-4" />
            <p className="text-bambu-gray">No projects found</p>
            <p className="text-bambu-gray/70 text-sm mt-1">
              Create a project to group related prints together
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleClick(project)}
              onEdit={() => handleEdit(project)}
              onDelete={() => handleDeleteClick(project.id)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm !== null && (
        <ConfirmModal
          title="Delete Project"
          message="Are you sure you want to delete this project? Archives and queue items will be unlinked but not deleted."
          confirmText="Delete Project"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Modal */}
      {showModal && (
        <ProjectModal
          project={editingProject}
          onClose={() => {
            setShowModal(false);
            setEditingProject(undefined);
          }}
          onSave={handleSave}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}
