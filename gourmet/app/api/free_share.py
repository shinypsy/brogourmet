from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, joinedload

from app.core.roles import SUPER_ADMIN
from app.deps import (
    can_moderate_community_post_district,
    ensure_can_write_faq_post,
    ensure_community_post_author_or_moderation,
    ensure_community_post_super_admin_delete,
    get_current_user,
    get_db,
)
from app.models.free_share_comment import FreeShareComment
from app.models.free_share_post import FreeSharePost
from app.models.user import User
from app.schemas.community import (
    BOARD_WRITE_MAX_IMAGES,
    FreeShareCommentCreate,
    FreeShareCommentRead,
    FreeSharePostCreate,
    FreeSharePostRead,
    FreeSharePostUpdate,
)

router = APIRouter(prefix="/free-share", tags=["free-share"])


def _category_read(
    post: FreeSharePost,
) -> Literal["food", "appliance", "furniture", "books", "other", "qa", "faq"]:
    raw = (getattr(post, "share_category", None) or "other").strip().lower()
    if raw == "food":
        return "food"
    if raw == "appliance":
        return "appliance"
    if raw == "furniture":
        return "furniture"
    if raw == "books":
        return "books"
    if raw == "qa":
        return "qa"
    if raw == "faq":
        return "faq"
    if raw == "other":
        return "other"
    return "other"


def _urls_from_orm(post: FreeSharePost) -> list[str]:
    raw = getattr(post, "image_urls", None)
    if isinstance(raw, list) and len(raw) > 0:
        out: list[str] = []
        seen: set[str] = set()
        for u in raw:
            t = str(u).strip()[:500]
            if t and t not in seen:
                seen.add(t)
                out.append(t)
            if len(out) >= 5:
                break
        return out
    legacy = (post.image_url or "").strip()
    return [legacy[:500]] if legacy else []


def _apply_image_columns(post: FreeSharePost, urls: list[str]) -> None:
    post.image_urls = urls if urls else None
    post.image_url = urls[0] if urls else None


def _to_read(post: FreeSharePost) -> FreeSharePostRead:
    urls = _urls_from_orm(post)
    return FreeSharePostRead(
        id=post.id,
        author_id=post.author_id,
        title=post.title,
        body=post.body,
        district=post.district,
        image_url=urls[0] if urls else None,
        image_urls=urls,
        share_completed=bool(post.share_completed),
        share_category=_category_read(post),
        share_latitude=getattr(post, "share_latitude", None),
        share_longitude=getattr(post, "share_longitude", None),
        share_place_label=getattr(post, "share_place_label", None),
        author_nickname=post.author.nickname,
        created_at=post.created_at,
    )


def _post_or_404(db: Session, post_id: int) -> FreeSharePost:
    post = (
        db.query(FreeSharePost)
        .options(joinedload(FreeSharePost.author))
        .filter(FreeSharePost.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post


def _ensure_comment_delete(
    user: User,
    comment: FreeShareComment,
    post: FreeSharePost,
    db: Session,
) -> None:
    if comment.user_id == user.id:
        return
    if user.role == SUPER_ADMIN:
        return
    if can_moderate_community_post_district(user, post.district, db):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="댓글 삭제는 본인·최종 관리자·해당 구 담당자만 할 수 있습니다.",
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
    post = _post_or_404(db, post_id)
    return _to_read(post)


@router.post("/posts", response_model=FreeSharePostRead, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: FreeSharePostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.share_category == "faq":
        ensure_can_write_faq_post(current_user)
    urls = list(payload.image_urls)[:BOARD_WRITE_MAX_IMAGES]
    post = FreeSharePost(
        author_id=current_user.id,
        title=payload.title,
        body=payload.body,
        district=payload.district,
        share_completed=False,
        share_category=payload.share_category,
        image_url=urls[0] if urls else None,
        image_urls=urls if urls else None,
        share_latitude=payload.share_latitude,
        share_longitude=payload.share_longitude,
        share_place_label=payload.share_place_label,
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
    payload: FreeSharePostUpdate,
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

    raw_existing = (getattr(post, "share_category", None) or "other").strip().lower()
    if raw_existing == "faq" and payload.share_category != "faq":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FAQ 글의 분류를 다른 값으로 바꿀 수 없습니다.",
        )
    if payload.share_category == "faq" and raw_existing != "faq":
        ensure_can_write_faq_post(current_user)

    urls = list(payload.image_urls)[:BOARD_WRITE_MAX_IMAGES]
    post.title = payload.title
    post.body = payload.body
    post.district = payload.district
    post.share_completed = payload.share_completed
    post.share_category = payload.share_category
    post.share_latitude = payload.share_latitude
    post.share_longitude = payload.share_longitude
    post.share_place_label = payload.share_place_label
    _apply_image_columns(post, urls)
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


@router.get("/posts/{post_id}/comments", response_model=list[FreeShareCommentRead])
def list_comments(post_id: int, db: Session = Depends(get_db)):
    _post_or_404(db, post_id)
    rows = (
        db.query(FreeShareComment)
        .options(joinedload(FreeShareComment.author))
        .filter(FreeShareComment.post_id == post_id)
        .order_by(FreeShareComment.created_at.asc())
        .all()
    )
    return [
        FreeShareCommentRead(
            id=c.id,
            body=c.body,
            user_id=c.user_id,
            author_nickname=c.author.nickname if c.author else "",
            created_at=c.created_at,
        )
        for c in rows
    ]


@router.post(
    "/posts/{post_id}/comments",
    response_model=FreeShareCommentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    post_id: int,
    payload: FreeShareCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _post_or_404(db, post_id)
    raw_cat = (getattr(post, "share_category", None) or "other").strip().lower()
    if raw_cat in ("qa", "faq"):
        if not can_moderate_community_post_district(current_user, post.district, db):
            detail = (
                "Q&A 답변은 최종 관리자 또는 해당 구 지역 담당자만 등록할 수 있습니다."
                if raw_cat == "qa"
                else "FAQ 댓글은 최종 관리자 또는 해당 구 지역 담당자만 등록할 수 있습니다."
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
    c = FreeShareComment(
        post_id=post_id,
        user_id=current_user.id,
        body=payload.body.strip(),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    c = (
        db.query(FreeShareComment)
        .options(joinedload(FreeShareComment.author))
        .filter(FreeShareComment.id == c.id)
        .first()
    )
    assert c is not None
    return FreeShareCommentRead(
        id=c.id,
        body=c.body,
        user_id=c.user_id,
        author_nickname=c.author.nickname if c.author else "",
        created_at=c.created_at,
    )


@router.delete("/posts/{post_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    post_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    post = _post_or_404(db, post_id)
    c = (
        db.query(FreeShareComment)
        .filter(
            FreeShareComment.id == comment_id,
            FreeShareComment.post_id == post_id,
        )
        .first()
    )
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    _ensure_comment_delete(current_user, c, post, db)
    db.delete(c)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
