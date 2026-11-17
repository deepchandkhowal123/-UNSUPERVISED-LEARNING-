"""Generate realistic synthetic intelligence-graph data and load into SQLite."""
import random
import json
from datetime import datetime, timedelta
from .. import config
from ..database import cursor
from ..models import now

# Realistic seed pools
PERSON_FIRST = ["James", "Maria", "Wei", "Ahmed", "Sofia", "Raj", "Olga", "Hassan", "Lucia", "Dmitri",
                "Fatima", "Chen", "Carlos", "Yuki", "Ivan", "Priya", "Omar", "Elena", "Karl", "Aisha",
                "Marcus", "Lin", "Pavel", "Noor", "Diego", "Anya", "Tariq", "Bianca", "Sven", "Mei"]
PERSON_LAST = ["Reyes", "Khan", "Volkov", "Chen", "Müller", "Okafor", "Silva", "Tanaka", "Patel", "Ivanov",
               "Garcia", "Nguyen", "Rossi", "Kim", "Haddad", "Novak", "Costa", "Singh", "Lopez", "Yamamoto"]
ORG_NAMES = ["Atlas Holdings", "BluePeak Capital", "Cobalt Logistics", "Delta Freight", "Evergreen Trading",
             "Falcon Enterprises", "Granite Investments", "Helix Ventures", "Iris Imports", "Jade Maritime",
             "Keystone Group", "Lumen Partners", "Meridian Exchange", "Nimbus Holdings", "Orion Shipping",
             "Pinnacle Resources", "Quantum Trade", "Raven Networks", "Sigma Logistics", "Titan Worldwide"]
COUNTRIES = ["US", "GB", "AE", "SG", "HK", "CY", "SC", "PA", "MT", "CH", "DE", "CN", "RU", "IN", "BR"]
REGIONS_BY_COUNTRY = {"US": ["NY", "CA", "FL", "TX"], "GB": ["London", "Manchester"], "AE": ["Dubai", "Abu Dhabi"],
                      "SG": ["Singapore"], "HK": ["Hong Kong"], "CY": ["Nicosia", "Limassol"], "SC": ["Victoria"],
                      "PA": ["Panama City"], "MT": ["Valletta"], "CH": ["Zurich", "Geneva"], "DE": ["Frankfurt", "Berlin"],
                      "CN": ["Shanghai", "Shenzhen"], "RU": ["Moscow"], "IN": ["Mumbai", "Delhi"], "BR": ["Sao Paulo"]}
ACCOUNT_TYPES = ["checking", "savings", "offshore", "merchant", "crypto"]
PHONE_PREFIX = {"US": "+1", "GB": "+44", "AE": "+971", "SG": "+65", "HK": "+852", "CY": "+357", "DE": "+49", "CN": "+86"}
COMPANY_SUFFIX = ["Ltd", "LLC", "GmbH", "SARL", "Inc", "Group", "Holdings"]

REL_TYPES = ["transfers_to", "owns", "calls", "emails", "transacts", "family", "employee_of",
             "located_at", "board_member", "shareholder"]
RISK_LABELS = ["low", "medium", "high", "critical"]


def _risk_for_type(t):
    base = {"person": 25, "organization": 40, "account": 50, "phone": 20, "email": 15,
            "address": 30, "vehicle": 45, "asset": 60, "company": 55}
    return base.get(t, 30)


def _gen_name(t, rng):
    if t == "person":
        return f"{rng.choice(PERSON_FIRST)} {rng.choice(PERSON_LAST)}"
    if t in ("organization", "company"):
        base = rng.choice(ORG_NAMES)
        return f"{base} {rng.choice(COMPANY_SUFFIX)}" if rng.random() < 0.6 else base
    if t == "account":
        return f"Acct {rng.randint(10000, 99999)} ({rng.choice(ACCOUNT_TYPES)})"
    if t == "phone":
        cc = rng.choice(list(PHONE_PREFIX.keys()))
        return f"{PHONE_PREFIX[cc]} {rng.randint(100, 999)}-{rng.randint(1000, 9999)}"
    if t == "email":
        user = rng.choice(PERSON_FIRST).lower() + rng.choice(PERSON_LAST).lower() + str(rng.randint(1, 99))
        dom = rng.choice(["mail.com", "proton.me", "fastmail.net", "tutamail.com", "biz.io"])
        return f"{user}@{dom}"
    if t == "address":
        return f"{rng.randint(1, 9999)} {rng.choice(['Market', 'Oak', 'King', 'Harbor', 'Park'])} St, {rng.choice(COUNTRIES)}"
    if t == "vehicle":
        return f"VIN {rng.randint(1000000, 9999999)} ({rng.choice(['Sedan', 'SUV', 'Van', 'Truck'])})"
    if t == "asset":
        return f"Asset {rng.randint(1000, 9999)} ({rng.choice(['Real Estate', 'Vessel', 'Aircraft', 'Art', 'Jewelry'])})"
    return f"{t.title()} {rng.randint(1000, 9999)}"


def _make_entity(i, rng):
    # type distribution
    t = rng.choices(
        ["person", "organization", "account", "phone", "email", "address", "vehicle", "asset", "company"],
        weights=[35, 12, 15, 8, 8, 8, 6, 4, 4])[0]
    country = rng.choice(COUNTRIES)
    region = rng.choice(REGIONS_BY_COUNTRY.get(country, [country]))
    base_risk = _risk_for_type(t)
    risk = max(0, min(100, rng.gauss(base_risk, 18)))
    created = (datetime.utcnow() - timedelta(days=rng.randint(30, 900))).isoformat() + "Z"
    last_seen = (datetime.utcnow() - timedelta(days=rng.randint(0, 30))).isoformat() + "Z"
    metadata = {"flags": [], "source": rng.choice(["FIU", "OSINT", "Customs", "Bank", "Field"]) }
    if rng.random() < 0.12:
        metadata["flags"].append("pep")
    if rng.random() < 0.08:
        metadata["flags"].append("sanction_hit")
    if rng.random() < 0.10:
        metadata["flags"].append("shell_company")
    return {
        "id": f"E{i:05d}",
        "name": _gen_name(t, rng),
        "type": t,
        "subtype": rng.choice(ACCOUNT_TYPES) if t == "account" else None,
        "risk_score": round(risk, 1),
        "country": country,
        "region": region,
        "created_at": created,
        "last_seen": last_seen,
        "metadata": metadata,
    }


def generate():
    rng = random.Random(config.SEED)
    ents = [_make_entity(i, rng) for i in range(1, config.NUM_ENTITIES + 1)]
    # bucket ids by type for realistic edges
    by_type = {}
    for e in ents:
        by_type.setdefault(e["type"], []).append(e["id"])
    type_keys = list(by_type.keys())

    rels = []
    rel_id = 1
    # Prefer meaningful type pairings
    def pick_target(src_type, rng):
        # people link to orgs/accounts/phones/emails/addresses; orgs to accounts/addresses/people; etc.
        prefer = {
            "person": ["organization", "account", "phone", "email", "address", "company"],
            "organization": ["account", "address", "person", "company", "asset"],
            "company": ["account", "address", "person", "asset"],
            "account": ["account", "organization", "person", "company"],
            "phone": ["person", "phone"],
            "email": ["person", "organization", "email"],
            "address": ["person", "organization", "company"],
            "vehicle": ["person", "organization"],
            "asset": ["person", "organization", "company"],
        }
        choices = prefer.get(src_type, type_keys)
        valid = [c for c in choices if c in by_type and c != src_type]
        if src_type in by_type and rng.random() < 0.15 and src_type in choices:
            valid.append(src_type)
        if not valid:
            valid = [t for t in type_keys if t != src_type and by_type.get(t)]
        if not valid:
            valid = type_keys
        t = rng.choice(valid)
        return rng.choice(by_type[t])

    while len(rels) < config.NUM_RELATIONSHIPS:
        src = rng.choice(ents)
        tgt_id = pick_target(src["type"], rng)
        if tgt_id == src["id"]:
            continue
        rtype = rng.choice(REL_TYPES)
        amt = 0
        currency = None
        if rtype in ("transfers_to", "transacts"):
            amt = round(10 ** rng.uniform(2, 6), 2)
            currency = rng.choice(["USD", "EUR", "AED", "SGD", "BTC"])
        weight = round(rng.uniform(0.3, 1.0), 2)
        occurred = (datetime.utcnow() - timedelta(days=rng.randint(0, 365))).isoformat() + "Z"
        rels.append({
            "id": f"R{rel_id:05d}",
            "source_id": src["id"],
            "target_id": tgt_id,
            "rel_type": rtype,
            "weight": weight,
            "amount": amt,
            "currency": currency,
            "occurred_at": occurred,
            "metadata": {"channel": rng.choice(["wire", "swift", "crypto", "cash", "mobile"])},
        })
        rel_id += 1

    # Persist
    with cursor() as c:
        c.execute("DELETE FROM entities")
        c.execute("DELETE FROM relationships")
        c.executemany(
            "INSERT INTO entities (id,name,type,subtype,risk_score,country,region,created_at,last_seen,metadata) "
            "VALUES (:id,:name,:type,:subtype,:risk_score,:country,:region,:created_at,:last_seen,:metadata)",
            [{**e, "metadata": json.dumps(e["metadata"])} for e in ents])
        c.executemany(
            "INSERT INTO relationships (id,source_id,target_id,rel_type,weight,amount,currency,occurred_at,metadata) "
            "VALUES (:id,:source_id,:target_id,:rel_type,:weight,:amount,:currency,:occurred_at,:metadata)",
            [{**r, "metadata": json.dumps(r["metadata"])} for r in rels])
    return len(ents), len(rels)


def is_loaded() -> bool:
    from ..database import db_size
    e, r = db_size()
    return e > 0 and r > 0
