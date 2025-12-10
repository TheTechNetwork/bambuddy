from datetime import datetime
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    """Schema for creating a new project."""
    name: str
    description: str | None = None
    color: str | None = None
    target_count: int | None = None


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""
    name: str | None = None
    description: str | None = None
    color: str | None = None
    status: str | None = None  # active, completed, archived
    target_count: int | None = None


class ProjectStats(BaseModel):
    """Statistics for a project."""
    total_archives: int = 0
    completed_prints: int = 0
    failed_prints: int = 0
    queued_prints: int = 0
    in_progress_prints: int = 0
    total_print_time_hours: float = 0.0
    total_filament_grams: float = 0.0
    progress_percent: float | None = None  # Based on target_count


class ProjectResponse(BaseModel):
    """Schema for project response."""
    id: int
    name: str
    description: str | None
    color: str | None
    status: str
    target_count: int | None
    created_at: datetime
    updated_at: datetime
    stats: ProjectStats | None = None

    class Config:
        from_attributes = True


class ArchivePreview(BaseModel):
    """Minimal archive data for project preview."""
    id: int
    print_name: str | None
    thumbnail_path: str | None
    status: str


class ProjectListResponse(BaseModel):
    """Schema for project list item (lighter weight)."""
    id: int
    name: str
    description: str | None
    color: str | None
    status: str
    target_count: int | None
    created_at: datetime
    # Quick stats
    archive_count: int = 0
    queue_count: int = 0
    progress_percent: float | None = None
    # Preview of archives (up to 5)
    archives: list[ArchivePreview] = []

    class Config:
        from_attributes = True


class BatchAddArchives(BaseModel):
    """Schema for batch adding archives to a project."""
    archive_ids: list[int]


class BatchAddQueueItems(BaseModel):
    """Schema for batch adding queue items to a project."""
    queue_item_ids: list[int]
