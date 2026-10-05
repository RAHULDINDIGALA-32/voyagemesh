from uuid import UUID

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from config import get_settings


bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="SupabaseBearer",
    bearerFormat="JWT",
    description="Supabase user access token. Paste the token only; Swagger adds the Bearer prefix.",
)
_jwks_clients: dict[str, PyJWKClient] = {}


class AuthUser(BaseModel):
    id: UUID
    email: str | None = None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> AuthUser:
    settings = get_settings()
    if settings.supabase_jwt_secret is None and not settings.supabase_url:
        raise HTTPException(
            status_code=503,
            detail="Authentication is not configured: set SUPABASE_JWT_SECRET on the API server",
        )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        if algorithm == "HS256":
            if settings.supabase_jwt_secret is None:
                raise jwt.InvalidTokenError("HS256 secret is not configured")
            signing_key = settings.supabase_jwt_secret.get_secret_value()
        else:
            if not settings.supabase_url:
                raise jwt.InvalidTokenError("Supabase JWKS URL is not configured")
            jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
            client = _jwks_clients.setdefault(jwks_url, PyJWKClient(jwks_url, cache_jwk_set=True))
            signing_key = client.get_signing_key_from_jwt(token).key

        decode_options = {"algorithms": [algorithm] if algorithm else ["HS256"]}
        payload = jwt.decode(token, signing_key, audience="authenticated", **decode_options)
    except (jwt.PyJWTError, PyJWKClientError) as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid access token")
    return AuthUser(id=UUID(subject), email=payload.get("email"))
