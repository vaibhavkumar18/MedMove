# app/db/models.py
import uuid
from datetime import datetime, date

# 1. Import the unified Base
from app.db.base import Base

# 2. Import SQLAlchemy types (using universal Uuid for SQLite/Postgres compatibility)
from sqlalchemy import (
    String, Boolean, Integer, BigInteger, Date, DateTime,
    ForeignKey, JSON, UniqueConstraint, Uuid, Index, CheckConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

# ==========================================
# 3. Define Models (All inherit from 'Base')
# ==========================================

class Facility(Base):
    __tablename__ = "facilities"
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    facility_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    facility_type: Mapped[str] = mapped_column(String(40), nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    facility_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), ForeignKey("facilities.id"), nullable=True)
    facility: Mapped["Facility"] = relationship("Facility")
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    facility: Mapped["Facility"] = relationship("Facility")
    
    __table_args__ = (
        Index('ix_user_facility', 'facility_id'),
    )

class Medicine(Base):
    __tablename__ = "medicines"
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medicine_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    generic_name: Mapped[str] = mapped_column(String(160), nullable=False)
    strength: Mapped[str] = mapped_column(String(80), nullable=False)
    dosage_form: Mapped[str] = mapped_column(String(80), nullable=False)
    base_unit: Mapped[str] = mapped_column(String(40), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class InventoryBatch(Base):
    __tablename__ = "inventory_batches"
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    facility_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("facilities.id"), nullable=False)
    medicine_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("medicines.id"), nullable=False)
    lot_number: Mapped[str] = mapped_column(String(100), nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity_on_hand_units: Mapped[int] = mapped_column(Integer, nullable=False)
    quality_status: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    facility: Mapped["Facility"] = relationship("Facility")
    medicine: Mapped["Medicine"] = relationship("Medicine")
    
    __table_args__ = (
        UniqueConstraint('facility_id', 'medicine_id', 'lot_number', name='uix_fac_med_lot'),
        CheckConstraint('quantity_on_hand_units >= 0', name='chk_quantity_non_negative'),
        Index('ix_inv_fac_med', 'facility_id', 'medicine_id'),
        Index('ix_inv_expiry', 'expiry_date'),
    )
class FacilityMedicinePlan(Base):
    __tablename__ = "facility_medicine_plans"
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    facility_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("facilities.id"), nullable=False)
    medicine_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("medicines.id"), nullable=False)
    target_stock_units: Mapped[int] = mapped_column(Integer, nullable=False)
    minimum_reserve_units: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_daily_demand_units: Mapped[int] = mapped_column(Integer, nullable=False)
    priority_weight: Mapped[int] = mapped_column(Integer, nullable=False)
    minimum_remaining_shelf_life_days: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    facility: Mapped["Facility"] = relationship("Facility")
    medicine: Mapped["Medicine"] = relationship("Medicine")

    __table_args__ = (
        UniqueConstraint('facility_id', 'medicine_id', name='uix_fac_med_plan'),
        CheckConstraint('target_stock_units >= 0', name='chk_target_non_negative'),
        CheckConstraint('minimum_reserve_units >= 0', name='chk_reserve_non_negative'),
        CheckConstraint(
            'priority_weight BETWEEN 1 AND 5',
            name='chk_priority_between_1_and_5',
        ),
    )


class TransportRoute(Base):
    __tablename__ = "transport_routes"
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_code: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    source_facility_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("facilities.id"), nullable=False)
    destination_facility_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("facilities.id"), nullable=False)
    transit_days: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_per_unit_minor_units: Mapped[int] = mapped_column(Integer, nullable=False)
    route_capacity_units: Mapped[int] = mapped_column(Integer, nullable=False)
    currency_code: Mapped[str] = mapped_column(
        String(3),
        default="INR",
        server_default=text("'INR'"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    source_facility: Mapped["Facility"] = relationship("Facility", foreign_keys=[source_facility_id])
    destination_facility: Mapped["Facility"] = relationship("Facility", foreign_keys=[destination_facility_id])
    
    __table_args__ = (
        UniqueConstraint('source_facility_id', 'destination_facility_id', name='uix_source_dest'),
        CheckConstraint('source_facility_id != destination_facility_id', name='chk_no_self_route'),
        CheckConstraint('cost_per_unit_minor_units >= 0', name='chk_cost_non_negative'),
        CheckConstraint('route_capacity_units >= 0', name='chk_capacity_non_negative'),
    )
class OptimizationRun(Base):
    __tablename__ = "optimization_runs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    trigger_source: Mapped[str] = mapped_column(String(50), nullable=False)
    trigger_reason: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False) # RUNNING, COMPLETED, FAILED
    planning_date: Mapped[date] = mapped_column(Date, nullable=False)
    budget_minor_units: Mapped[int] = mapped_column(BigInteger, nullable=False)
    objective_policy: Mapped[str] = mapped_column(String(100), nullable=False)
    input_snapshot_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    input_summary_json: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
    )
    result_json: Mapped[dict | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    solver_status_stage_1: Mapped[str | None] = mapped_column(String(50), nullable=True)
    solver_status_stage_2: Mapped[str | None] = mapped_column(String(50), nullable=True)
    total_recommended_units: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_cost_minor_units: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_run_created', 'created_at'),
        Index('ix_run_hash', 'input_snapshot_hash'),
    )