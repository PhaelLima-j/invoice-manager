from pydantic import BaseModel, ConfigDict, EmailStr


class ClientBase(BaseModel):
    company_name: str
    cnpj: str
    address: str | None = None
    zip_code: str | None = None
    email: EmailStr
    phone: str | None = None


class ClientCreate(ClientBase):
    password: str


class ClientOut(ClientBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"