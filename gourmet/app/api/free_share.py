from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.deps import get_admin_user, get_current_user, get_db
from app.models.free_share_post import FreeSharePost
from app.models.user import User
from app.schemas.community import FreeSharePostCreate, FreeSharePostRead

router = APIRouter(prefix="/free-share", tags=["free-share"])


@router.get("/posts", response_model=list[FreeSharePostRead])
def list_posts(db: Session = Depends(get_db)):
    posts = (
        db.query(FreeSharePost)
        .options(joinedload(FreeSharePost.author))
        .order_by(FreeSharePost.created_at.desc())
        .all()
    )
    return [
        FreeSharePostRead(
            id=p.id,
            title=p.title,
            body=p.body,
            district=p.district,
            image_url=p.image_url,
            author_nickname=p.author.nickname,
            created_at=p.created_at,
        )
        for p in posts
    ]


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
    return FreeSharePostRead(
        id=post.id,
        title=post.title,
        body=post.body,
        district=post.district,
        image_url=post.image_url,
        author_nickname=post.author.nickname,
        created_at=post.created_at,
    )


@router.put("/posts/{post_id}", response_model=FreeSharePostRead)
def update_post(
    post_id: int,
    payload: FreeSharePostCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    post = (
        db.query(FreeSharePost)
        .options(joinedload(FreeSharePost.author))
        .filter(FreeSharePost.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    post.title = payload.title
    post.body = payload.body
    post.district = payload.district
    post.image_url = payload.image_url
    db.commit()
    db.refresh(post)
    return FreeSharePostRead(
        id=post.id,
        title=post.title,
        body=post.body,
        district=post.district,
        image_url=post.image_url,
        author_nickname=post.author.nickname,
        created_at=post.created_at,
    )


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    post = db.query(FreeSharePost).filter(FreeSharePost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    db.delete(post)
    db.commit()
