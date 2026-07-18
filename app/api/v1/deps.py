from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.client import Client

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_client(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Client:
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        client_id: str | None = payload.get("sub")
        if client_id is None:
            raise invalid_credentials
    except JWTError:
        raise invalid_credentials

    client = db.get(Client, int(client_id))
    if client is None:
        raise invalid_credentials
    return client