from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.deps import (
    ensure_community_post_author_or_moderation,
    ensure_community_post_super_admin_delete,
    get_current_user,
    get_db,
)
from app.models.free_share_post import FreeSharePost
from app.models.user import User
from app.schemas.community import FreeSharePostCreate, FreeSharePostRead

router = APIRouter(prefix="/free-share", tags=["free-share"])


def _to_read(post: FreeSharePost) -> FreeSharePostRead:
    return FreeSharePostRead(
        id=post.id,
        author_id=post.author_id,
        title=post.title,
        body=post.body,
        district=post.district,
        image_url=post.image_url,
        author_nickname=post.author.nickname,
        created_at=post.created_at,
    )


@router.get("/posts", response_model=list[FreeSharePostRead])
def list_posts(db: Session = Depends(get_db)):
    posts = (
        db.query(FreeSharePost)
        .options(joinedload(FreeSharePost.author))
        .order_by(FreeSharePost.created_at.desc())
        .all()
    )
    return [_to_read(p) for p in posts]


@router.get("/posts/{post_id}", response_model=FreeSharePostRead)
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = (
        db.query(FreeSharePost)
        .options(joinedload(FreeSharePost.author))
        .filter(FreeSharePost.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return _to_read(post)


@router.post("/posts", response_model=FreeSharePostRead, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: FreeSharePostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = FreeSharePost(
        author_id=current_user.id,
        title=payload.title,
        body=payload.body,
        district=payload.district,
        image_url=payload.image_url,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    post = (
        db.query(FreeSharePost)
        .options(joinedload(FreeSharePost.author))
        .filter(FreeSharePost.id == post.id)
        .first()
    )
    assert post is not None
    return _to_read(post)


@router.put("/posts/{post_id}", response_model=FreeSharePostRead)
def update_post(
    post_id: int,
    payload: FreeSharePostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = (
        db.query(FreeSharePost)
        .options(joinedload(FreeSharePost.author))
        .filter(FreeSharePost.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    ensure_community_post_author_or_moderation(current_user, post.author_id, post.district, db)

    post.title = payload.title
    post.body = payload.body
    post.district = payload.district
    post.image_url = payload.image_url
    db.commit()
    db.refresh(post)
    return _to_read(post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(FreeSharePost).filter(FreeSharePost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    ensure_community_post_super_admin_delete(current_user)
    db.delete(post)
    db.commit()
