from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.deps import get_admin_user, get_current_user, get_db
from app.models.known_restaurant_post import KnownRestaurantPost
from app.models.user import User
from app.schemas.community import KnownRestaurantPostCreate, KnownRestaurantPostRead

router = APIRouter(prefix="/known-restaurants", tags=["known-restaurants"])


@router.get("/posts", response_model=list[KnownRestaurantPostRead])
def list_posts(db: Session = Depends(get_db)):
    posts = (
        db.query(KnownRestaurantPost)
        .options(joinedload(KnownRestaurantPost.author))
        .order_by(KnownRestaurantPost.created_at.desc())
        .all()
    )
    return [
        KnownRestaurantPostRead(
            id=p.id,
            title=p.title,
            body=p.body,
            restaurant_name=p.restaurant_name,
            district=p.district,
            main_menu_name=p.main_menu_name,
            main_menu_price=p.main_menu_price,
            image_url=p.image_url,
            author_nickname=p.author.nickname,
            created_at=p.created_at,
        )
        for p in posts
    ]


@router.post("/posts", response_model=KnownRestaurantPostRead, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: KnownRestaurantPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = KnownRestaurantPost(
        author_id=current_user.id,
        title=payload.title,
        body=payload.body,
        restaurant_name=payload.restaurant_name,
        district=payload.district,
        main_menu_name=payload.main_menu_name,
        main_menu_price=payload.main_menu_price,
        image_url=payload.image_url,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    post = (
        db.query(KnownRestaurantPost)
        .options(joinedload(KnownRestaurantPost.author))
        .filter(KnownRestaurantPost.id == post.id)
        .first()
    )
    assert post is not None
    return KnownRestaurantPostRead(
        id=post.id,
        title=post.title,
        body=post.body,
        restaurant_name=post.restaurant_name,
        district=post.district,
        main_menu_name=post.main_menu_name,
        main_menu_price=post.main_menu_price,
        image_url=post.image_url,
        author_nickname=post.author.nickname,
        created_at=post.created_at,
    )


@router.put("/posts/{post_id}", response_model=KnownRestaurantPostRead)
def update_post(
    post_id: int,
    payload: KnownRestaurantPostCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    post = (
        db.query(KnownRestaurantPost)
        .options(joinedload(KnownRestaurantPost.author))
        .filter(KnownRestaurantPost.id == post_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    post.title = payload.title
    post.body = payload.body
    post.restaurant_name = payload.restaurant_name
    post.district = payload.district
    post.main_menu_name = payload.main_menu_name
    post.main_menu_price = payload.main_menu_price
    post.image_url = payload.image_url
    db.commit()
    db.refresh(post)
    return KnownRestaurantPostRead(
        id=post.id,
        title=post.title,
        body=post.body,
        restaurant_name=post.restaurant_name,
        district=post.district,
        main_menu_name=post.main_menu_name,
        main_menu_price=post.main_menu_price,
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
    post = db.query(KnownRestaurantPost).filter(KnownRestaurantPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    db.delete(post)
    db.commit()
