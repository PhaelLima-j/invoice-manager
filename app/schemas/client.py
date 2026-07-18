import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ClientBase(BaseModel):
    company_name: str
    cnpj: str
    address: str | None = None
    zip_code: str | None = None
    email: EmailStr
    phone: str | None = None

    @field_validator("cnpj")
    @classmethod
    def validar_cnpj(cls, value: str) -> str:
        if len(re.sub(r"\D", "", value or "")) != 14:
            raise ValueError("CNPJ deve conter 14 dígitos")
        return value

    @field_validator("zip_code")
    @classmethod
    def validar_cep(cls, value: str | None) -> str | None:
        if not value:
            return value
        if len(re.sub(r"\D", "", value)) != 8:
            raise ValueError("CEP deve conter 8 dígitos")
        return value


class ClientCreate(ClientBase):
    password: str = Field(min_length=8)


class ClientOut(ClientBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"