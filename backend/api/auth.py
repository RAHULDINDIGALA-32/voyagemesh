from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from config import get_settings


bearer_scheme = HTTPBearer(auto_error=False)


class AuthUser(BaseModel):
    id: UUID
    email: str | None = None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthUser:
    settings = get_settings()
    if settings.supabase_jwt_secret is None:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid access token")
    return AuthUser(id=UUID(subject), email=payload.get("email"))
