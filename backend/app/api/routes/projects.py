import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.app.core.database import get_db
from backend.app.models.project import Project
from backend.app.models.archive import PrintArchive
from backend.app.models.print_queue import PrintQueueItem
from backend.app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectStats,
    BatchAddArchives,
    BatchAddQueueItems,
    ArchivePreview,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


async def compute_project_stats(
    db: AsyncSession, project_id: int, target_count: int | None = None
) -> ProjectStats:
    """Compute statistics for a project."""
    # Count total archives
    total_result = await db.execute(
        select(func.count(PrintArchive.id)).where(PrintArchive.project_id == project_id)
    )
    total_archives = total_result.scalar() or 0

    # Count completed archives
    completed_result = await db.execute(
        select(func.count(PrintArchive.id)).where(
            PrintArchive.project_id == project_id,
            PrintArchive.status == "completed"
        )
    )
    completed_prints = completed_result.scalar() or 0

    # Count failed archives
    failed_result = await db.execute(
        select(func.count(PrintArchive.id)).where(
            PrintArchive.project_id == project_id,
            PrintArchive.status == "failed"
        )
    )
    failed_prints = failed_result.scalar() or 0

    # Sum print time and filament
    sums_result = await db.execute(
        select(
            func.coalesce(func.sum(PrintArchive.print_time_seconds), 0).label("total_time"),
            func.coalesce(func.sum(PrintArchive.filament_used_grams), 0).label("total_filament"),
        ).where(PrintArchive.project_id == project_id)
    )
    sums = sums_result.first()

    # Count queued items
    queued_result = await db.execute(
        select(func.count(PrintQueueItem.id)).where(
            PrintQueueItem.project_id == project_id,
            PrintQueueItem.status == "pending"
        )
    )
    queued_prints = queued_result.scalar() or 0

    # Count in-progress items
    in_progress_result = await db.execute(
        select(func.count(PrintQueueItem.id)).where(
            PrintQueueItem.project_id == project_id,
            PrintQueueItem.status == "printing"
        )
    )
    in_progress_prints = in_progress_result.scalar() or 0

    # Calculate progress
    progress_percent = None
    if target_count and target_count > 0:
        progress_percent = round((completed_prints / target_count) * 100, 1)

    return ProjectStats(
        total_archives=total_archives,
        completed_prints=completed_prints,
        failed_prints=failed_prints,
        queued_prints=queued_prints,
        in_progress_prints=in_progress_prints,
        total_print_time_hours=round((sums.total_time or 0) / 3600, 2),
        total_filament_grams=round(sums.total_filament or 0, 2),
        progress_percent=progress_percent,
    )


@router.get("", response_model=list[ProjectListResponse])
@router.get("/", response_model=list[ProjectListResponse])
async def list_projects(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all projects with basic stats."""
    query = select(Project)
    if status:
        query = query.where(Project.status == status)
    query = query.order_by(Project.updated_at.desc())

    result = await db.execute(query)
    projects = result.scalars().all()

    # Compute quick stats for each project
    response = []
    for project in projects:
        # Get archive count
        archive_count_result = await db.execute(
            select(func.count(PrintArchive.id)).where(
                PrintArchive.project_id == project.id
            )
        )
        archive_count = archive_count_result.scalar() or 0

        # Get queue count
        queue_count_result = await db.execute(
            select(func.count(PrintQueueItem.id)).where(
                PrintQueueItem.project_id == project.id,
                PrintQueueItem.status.in_(["pending", "printing"]),
            )
        )
        queue_count = queue_count_result.scalar() or 0

        # Get completed count for progress
        completed_result = await db.execute(
            select(func.count(PrintArchive.id)).where(
                PrintArchive.project_id == project.id,
                PrintArchive.status == "completed",
            )
        )
        completed_count = completed_result.scalar() or 0

        progress_percent = None
        if project.target_count and project.target_count > 0:
            progress_percent = round((completed_count / project.target_count) * 100, 1)

        # Get archive previews (up to 6 most recent)
        archives_result = await db.execute(
            select(PrintArchive)
            .where(PrintArchive.project_id == project.id)
            .order_by(PrintArchive.created_at.desc())
            .limit(6)
        )
        archives = archives_result.scalars().all()
        archive_previews = [
            ArchivePreview(
                id=a.id,
                print_name=a.print_name,
                thumbnail_path=a.thumbnail_path,
                status=a.status,
            )
            for a in archives
        ]

        response.append(
            ProjectListResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                color=project.color,
                status=project.status,
                target_count=project.target_count,
                created_at=project.created_at,
                archive_count=archive_count,
                queue_count=queue_count,
                progress_percent=progress_percent,
                archives=archive_previews,
            )
        )

    return response


@router.post("/", response_model=ProjectResponse)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new project."""
    project = Project(
        name=data.name,
        description=data.description,
        color=data.color,
        target_count=data.target_count,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)

    stats = await compute_project_stats(db, project.id, project.target_count)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        status=project.status,
        target_count=project.target_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
        stats=stats,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a project by ID with detailed stats."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stats = await compute_project_stats(db, project.id, project.target_count)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        status=project.status,
        target_count=project.target_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
        stats=stats,
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a project."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Update fields if provided
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.color is not None:
        project.color = data.color
    if data.status is not None:
        if data.status not in ["active", "completed", "archived"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        project.status = data.status
    if data.target_count is not None:
        project.target_count = data.target_count

    await db.flush()
    await db.refresh(project)

    stats = await compute_project_stats(db, project.id, project.target_count)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        status=project.status,
        target_count=project.target_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
        stats=stats,
    )


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a project. Archives and queue items will have project_id set to NULL."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)

    return {"message": "Project deleted"}


@router.get("/{project_id}/archives")
async def list_project_archives(
    project_id: int,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List archives in a project."""
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Get archives
    query = (
        select(PrintArchive)
        .where(PrintArchive.project_id == project_id)
        .order_by(PrintArchive.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    archives = result.scalars().all()

    # Import the response converter from archives module
    from backend.app.api.routes.archives import archive_to_response

    return [archive_to_response(a) for a in archives]


@router.get("/{project_id}/queue")
async def list_project_queue(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List queue items in a project."""
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Get queue items
    query = (
        select(PrintQueueItem)
        .where(PrintQueueItem.project_id == project_id)
        .order_by(PrintQueueItem.position)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return items


@router.post("/{project_id}/add-archives")
async def add_archives_to_project(
    project_id: int,
    data: BatchAddArchives,
    db: AsyncSession = Depends(get_db),
):
    """Batch add archives to a project."""
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Update archives
    updated = 0
    for archive_id in data.archive_ids:
        result = await db.execute(
            select(PrintArchive).where(PrintArchive.id == archive_id)
        )
        archive = result.scalar_one_or_none()
        if archive:
            archive.project_id = project_id
            updated += 1

    return {"message": f"Added {updated} archives to project"}


@router.post("/{project_id}/add-queue")
async def add_queue_items_to_project(
    project_id: int,
    data: BatchAddQueueItems,
    db: AsyncSession = Depends(get_db),
):
    """Batch add queue items to a project."""
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Update queue items
    updated = 0
    for item_id in data.queue_item_ids:
        result = await db.execute(
            select(PrintQueueItem).where(PrintQueueItem.id == item_id)
        )
        item = result.scalar_one_or_none()
        if item:
            item.project_id = project_id
            updated += 1

    return {"message": f"Added {updated} queue items to project"}


@router.post("/{project_id}/remove-archives")
async def remove_archives_from_project(
    project_id: int,
    data: BatchAddArchives,
    db: AsyncSession = Depends(get_db),
):
    """Remove archives from a project (sets project_id to NULL)."""
    updated = 0
    for archive_id in data.archive_ids:
        result = await db.execute(
            select(PrintArchive).where(
                PrintArchive.id == archive_id,
                PrintArchive.project_id == project_id,
            )
        )
        archive = result.scalar_one_or_none()
        if archive:
            archive.project_id = None
            updated += 1

    return {"message": f"Removed {updated} archives from project"}
