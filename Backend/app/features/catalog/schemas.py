from pydantic import BaseModel


class MedicineOption(BaseModel):
    medicine_code: str
    generic_name: str
    strength: str
    dosage_form: str
    base_unit: str


class MedicineCatalogResponse(BaseModel):
    medicines: list[MedicineOption]
