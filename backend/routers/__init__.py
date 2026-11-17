"""API routers package."""
from . import auth, entities, graph, analytics, search, investigations, reports, system

ROUTERS = [auth.router, entities.router, graph.router, analytics.router,
           search.router, investigations.router, reports.router, system.router]
