"""Pydantic request/response schemas."""
from datetime import datetime
from typing import Any, Optional, List, Dict
from pydantic import BaseModel, Field


def now() -> str:
    return datetime.utcnow().isoformat() + "Z"


# --- Auth ---
class LoginRequest(BaseModel):
    username: str
    password: str


class User(BaseModel):
    username: str
    role: str
    display_name: str
    permissions: List[str]


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


# --- Entities ---
class Entity(BaseModel):
    id: str
    name: str
    type: str
    subtype: Optional[str] = None
    risk_score: float = 0
    country: Optional[str] = None
    region: Optional[str] = None
    created_at: Optional[str] = None
    last_seen: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EntityUpdate(BaseModel):
    name: Optional[str] = None
    risk_score: Optional[float] = Field(default=None, ge=0, le=100)
    country: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# --- Relationships ---
class Relationship(BaseModel):
    id: str
    source_id: str
    target_id: str
    rel_type: str
    weight: float = 1.0
    amount: float = 0
    currency: Optional[str] = None
    occurred_at: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


# --- Analytics ---
class GraphSnapshot(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    stats: Dict[str, Any]


class CentralityResult(BaseModel):
    entity_id: str
    name: str
    type: str
    betweenness: float
    pagerank: float
    eigenvector: float
    degree: int


class CommunityResult(BaseModel):
    community_id: int
    size: int
    members: List[str]
    top_entity: str
    avg_risk: float


class AnomalyResult(BaseModel):
    entity_id: str
    name: str
    type: str
    score: float
    method: str
    reason: str


class LinkPrediction(BaseModel):
    source_id: str
    target_id: str
    jaccard: float
    adamic_adar: float
    preferential: float
    predicted: bool


# --- Investigations ---
class Investigation(BaseModel):
    id: str
    title: str
    status: str = "open"
    priority: str = "medium"
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    created_by: str
    created_at: str
    updated_at: str
    entity_ids: List[str] = Field(default_factory=list)


class InvestigationCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    entity_ids: List[str] = Field(default_factory=list)


class Evidence(BaseModel):
    id: str
    investigation_id: str
    entity_id: Optional[str] = None
    kind: str
    content: str
    created_by: str
    created_at: str


class EvidenceCreate(BaseModel):
    investigation_id: str
    entity_id: Optional[str] = None
    kind: str = "note"
    content: str


# --- Audit ---
class AuditEntry(BaseModel):
    id: int
    ts: str
    username: Optional[str]
    role: Optional[str]
    action: str
    target: Optional[str]
    details: Optional[str]


# --- Reports ---
class ReportRequest(BaseModel):
    title: str = "NetworkTrace Report"
    investigation_id: Optional[str] = None
    sections: List[str] = Field(default_factory=lambda: ["summary", "entities", "graph", "anomalies"])


# --- Notes ---
class NoteCreate(BaseModel):
    entity_id: str
    content: str


class Note(BaseModel):
    id: str
    entity_id: str
    author: Optional[str] = None
    content: str
    created_at: Optional[str] = None


# --- Saved searches ---
class SavedSearchCreate(BaseModel):
    name: str
    query: Optional[str] = None
    filters: Optional[str] = None


class SavedSearch(BaseModel):
    id: str
    owner: str
    name: str
    query: Optional[str] = None
    filters: Optional[str] = None
    created_at: Optional[str] = None


# --- Bulk entity operations ---
class BulkTagUpdate(BaseModel):
    entity_ids: List[str]
    risk_score: Optional[float] = Field(default=None, ge=0, le=100)
    metadata: Optional[Dict[str, Any]] = None
