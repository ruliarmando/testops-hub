from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.auth.manager import UserManager, get_user_manager
from app.auth.strategy import get_access_token_strategy, get_refresh_token_strategy
from app.auth.users import fastapi_users
from app.models.user import User
from app.schemas.token import AccessToken, RefreshRequest, TokenPair
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

router.include_router(fastapi_users.get_register_router(UserRead, UserCreate))


async def _issue_token_pair(user: User) -> TokenPair:
    access_token = await get_access_token_strategy().write_token(user)
    refresh_token = await get_refresh_token_strategy().write_token(user)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/jwt/login", response_model=TokenPair)
async def login(
    credentials: OAuth2PasswordRequestForm = Depends(),
    user_manager: UserManager = Depends(get_user_manager),
) -> TokenPair:
    user = await user_manager.authenticate(credentials)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LOGIN_BAD_CREDENTIALS",
        )
    return await _issue_token_pair(user)


@router.post("/jwt/refresh", response_model=AccessToken)
async def refresh(
    body: RefreshRequest,
    user_manager: UserManager = Depends(get_user_manager),
) -> AccessToken:
    user = await get_refresh_token_strategy().read_token(body.refresh_token, user_manager)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_REFRESH_TOKEN",
        )
    access_token = await get_access_token_strategy().write_token(user)
    return AccessToken(access_token=access_token)
