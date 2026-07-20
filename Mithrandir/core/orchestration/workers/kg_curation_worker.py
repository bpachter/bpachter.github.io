"""KgCurationWorker: the first L3 climb — an agent that keeps the knowledge
graph clean on its own, through the harness gate.

Task type: kg_curation
Lane: fast (HTTP to Solaris admin API — $0, no models, no GPU)

Each run re-buckets mis-typed supply edges, merges exact-normalized duplicate
organizations, and quarantines categorically-broken edges. All are deterministic
and reversible (retype/retire markers, merge logs, node demotion). The worker never blindly
mutates prod: every action goes through `harness.run_safe_action`, which
dry-runs first, and the worker itself applies a **blast-radius gate** — small,
clearly-safe changes are applied autonomously; anything large is left as a
dry-run and escalated to a human for a GO. That gate is what makes this L3
(acts within bounds) rather than a rubber stamp.

Everything it does lands in the harness ledger, which feeds the outcome loop.
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any

from ..worker_dispatch import register
from .base import BaseWorker

if TYPE_CHECKING:
    from core.orchestration.swarm_queue import SwarmTask

log = logging.getLogger(__name__)

_MITHRANDIR_ROOT = Path(__file__).resolve().parents[3]

try:
    from dotenv import load_dotenv
    load_dotenv(_MITHRANDIR_ROOT / ".env")
except Exception:
    pass

# Blast-radius gate: at or below these, apply autonomously; above, escalate.
_MAX_CLEANUP = int(os.environ.get("KG_CURATION_MAX_CLEANUP", "150"))
_MAX_MERGES = int(os.environ.get("KG_CURATION_MAX_MERGES", "40"))
_MAX_QUARANTINE = int(os.environ.get("KG_CURATION_MAX_QUARANTINE", "60"))
# 2026-07-17 quality-sprint sweeps (all derived, reversible, idempotent —
# server-side logs beside the DB). Steady-state counts should be tiny; a big
# sudden number means an upstream writer regressed, which is exactly what the
# gate escalates instead of silently applying.
_MAX_PROGRAMS = int(os.environ.get("KG_CURATION_MAX_PROGRAM_MERGES", "150"))
_MAX_TOMBSTONES = int(os.environ.get("KG_CURATION_MAX_TOMBSTONES", "60"))
_MAX_RETIRES = int(os.environ.get("KG_CURATION_MAX_RETIRES", "60"))
_MAX_STAMPS = int(os.environ.get("KG_CURATION_MAX_STAMPS", "2500"))
_MAX_RECAL = int(os.environ.get("KG_CURATION_MAX_RECAL", "3000"))
_MAX_GRADUATE = int(os.environ.get("KG_CURATION_MAX_GRADUATE", "400"))
# Ontology-quality six (2026-07-20): deterministic gov corroboration + writer-
# reputation caps. Corroboration promotes trust from USASpending matches ($0,
# no models); a sudden huge count means the subawards sync changed shape.
_MAX_CORROBORATE = int(os.environ.get("KG_CURATION_MAX_CORROBORATE", "500"))
_MAX_REPUTATION = int(os.environ.get("KG_CURATION_MAX_REPUTATION", "2000"))
# Org family dedupe (2026-07-20): merges "Northrop Grumman Systems Corporation"
# etc. into their canonical (guarded: numeric/ticker/LEI/single-token vetoes,
# context-gated typo folds). First manual prod run merged 216; steady-state is
# a handful/day, so a sudden large count means a writer is minting variants —
# escalate rather than absorb.
_MAX_ORG_FAMILY = int(os.environ.get("KG_CURATION_MAX_ORG_FAMILY", "80"))


def _load_module(rel_path: str, name: str):
    import importlib.util
    spec = importlib.util.spec_from_file_location(name, str(_MITHRANDIR_ROOT / rel_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _live_edges(client: Any) -> dict[str, Any]:
    """Headline KG-health metric: live supply-edge count from coverage."""
    data = client._get("/api/space-intel/coverage")
    if isinstance(data, dict) and data.get("available"):
        ent = (data.get("coverage") or {}).get("entities", {})
        return {"liveEdges": ent.get("supplyEdges"), "documentedEdges": ent.get("documentedEdges")}
    return {}


def gate_action(action: Any, *, blast_keys: list[str], invariant_keys: list[str], limit: int) -> dict[str, Any]:
    """The L3 decision — now the shared harness primitive (kept as a thin
    wrapper so this worker's call sites and tests read domain-first)."""
    from core.orchestration import harness

    return harness.gate_by_blast_radius(
        action, blast_keys=blast_keys, limit=limit, expect_keys=invariant_keys)


@register("kg_curation")
class KgCurationWorker(BaseWorker):
    """Autonomous, reversible KG hygiene behind the harness gate (L3)."""

    def run(self, task: "SwarmTask") -> Any:
        t0 = time.time()
        try:
            sc = _load_module("tools/portfolio/solaris_client.py", "solaris_client")
            from core.orchestration import harness
        except Exception as exc:  # noqa: BLE001
            return self._err(task, f"kg_curation: load failed: {exc}",
                             elapsed_ms=int((time.time() - t0) * 1000),
                             worker_name="kg_curation_worker")

        metric = lambda: _live_edges(sc)  # noqa: E731
        steps = [
            {
                "name": "kg_supplies_cleanup",
                "path": "/api/admin/kg/cleanup/supplies",
                "payload": {},
                "invariant_keys": ["servesStaged", "dependsOnCreated", "retired"],
                "blast_keys": ["servesStaged", "dependsOnCreated", "retired"],
                "limit": _MAX_CLEANUP,
            },
            {
                "name": "kg_dedupe",
                "path": "/api/admin/kg/cleanup/dedupe",
                "payload": {},
                "invariant_keys": ["nodesMerged", "edgesRehomed", "redundantRemoved"],
                "blast_keys": ["nodesMerged"],
                "limit": _MAX_MERGES,
            },
            {
                # Reliability #2: reversibly retire categorically-broken edges
                # (heuristic_text_match, ...). A small batch applies autonomously;
                # a large sudden quarantine (something upstream broke) trips the
                # blast-radius gate and escalates to a human GO instead.
                "name": "kg_quarantine",
                "path": "/api/admin/kg/quarantine",
                "payload": {},
                "invariant_keys": ["retired"],
                "blast_keys": ["retired"],
                "limit": _MAX_QUARANTINE,
            },
            # ── 2026-07-17 quality-sprint sweeps, in runbook order ────────────
            {
                "name": "kg_near_dupes",
                "path": "/api/admin/kg/cleanup/near-dupes",
                "payload": {},
                "invariant_keys": ["mergesApplied", "edgesRehomed", "vetoed"],
                "blast_keys": ["mergesApplied"],
                "limit": _MAX_MERGES,
            },
            {
                "name": "kg_program_dedupe",
                "path": "/api/admin/kg/cleanup/dedupe-programs",
                "payload": {},
                "invariant_keys": ["programsMerged", "servesRehomed", "emptyDupesDeleted"],
                "blast_keys": ["programsMerged"],
                "limit": _MAX_PROGRAMS,
            },
            {
                # Org family dedupe (2026-07-20): the fragmentation recall
                # exposed (15 "Northrop Grumman" nodes). Guarded + reversible
                # (demote-to-generic); first manual prod run validated clean.
                # Ticker/LEI conflicts + single-token families are held for a
                # human in the response, never auto-merged.
                "name": "kg_org_family_dedupe",
                "path": "/api/admin/kg/cleanup/dedupe-org-families",
                "payload": {},
                "invariant_keys": ["clusters", "nodesMerged", "vetoed"],
                "blast_keys": ["nodesMerged"],
                "limit": _MAX_ORG_FAMILY,
            },
            {
                "name": "kg_rehome_tombstones",
                "path": "/api/admin/kg/cleanup/rehome-tombstones",
                "payload": {},
                "invariant_keys": ["edgesRehomed", "duplicatesRetired"],
                "blast_keys": ["edgesRehomed"],
                "limit": _MAX_TOMBSTONES,
            },
            {
                "name": "kg_retire_refuted",
                "path": "/api/admin/kg/cleanup/retire-refuted",
                "payload": {},
                "invariant_keys": ["retiresApplied"],
                "blast_keys": ["retiresApplied"],
                "limit": _MAX_RETIRES,
            },
            {
                # Metadata-only: records classifier agreement, never changes a type.
                "name": "kg_stamp_typing",
                "path": "/api/admin/kg/quality/stamp-typing",
                "payload": {},
                "invariant_keys": ["stamped", "disagreements"],
                "blast_keys": ["stamped"],
                "limit": _MAX_STAMPS,
            },
            {
                # Tier-anchored confidence; a sudden large 'changed' means an
                # upstream writer is inflating again — escalate, don't absorb.
                "name": "kg_recalibrate_confidence",
                "path": "/api/admin/kg/quality/recalibrate-confidence",
                "payload": {},
                "invariant_keys": ["changed", "scanned"],
                "blast_keys": ["changed"],
                "limit": _MAX_RECAL,
            },
            {
                # Name/description hygiene (2026-07-20): sentence-case raw
                # lowercase node names, clear internal-jargon descriptions.
                # Guarded + reversible server-side; ALL-CAPS names report-only.
                "name": "kg_name_hygiene",
                "path": "/api/admin/kg/hygiene/names",
                "payload": {},
                "invariant_keys": ["namesCased", "descriptionsCleared"],
                "blast_keys": ["namesCased"],
                "limit": int(os.environ.get("KG_CURATION_MAX_NAME_HYGIENE", "500")),
            },
            {
                # Gov-data corroboration (2026-07-20): reported/unverified live
                # edges whose supplier→customer pair matches a USASpending
                # subaward get government-tier evidence attached — deterministic
                # trust promotion, the direct lever on verified%.
                "name": "kg_gov_corroborate",
                "path": "/api/admin/kg/corroborate/gov-data",
                "payload": {},
                "invariant_keys": ["candidates", "corroborated"],
                "blast_keys": ["candidates"],
                "limit": _MAX_CORROBORATE,
            },
            {
                # Writer reputation (2026-07-20): confidence CAPPED at each
                # writer's measured audit accuracy (idempotent by construction).
                # A sudden large 'changed' means a writer regressed — escalate.
                "name": "kg_writer_reputation",
                "path": "/api/admin/kg/quality/apply-writer-reputation",
                "payload": {},
                "invariant_keys": ["scanned", "changed"],
                "blast_keys": ["changed"],
                "limit": _MAX_REPUTATION,
            },
            {
                # Graduation (2026-07-19): names the fleet has enriched +
                # verified past the bar join the browsable front end. Runs
                # LAST, after every hygiene step, so a node graduates on its
                # post-cleanup state. Additive + idempotent; a sudden huge
                # 'promoted' count means the bar or an upstream writer
                # changed — escalate for a look rather than silently flooding
                # the screener.
                "name": "kg_graduation",
                "path": "/api/admin/kg/graduation/promote",
                "payload": {},
                "invariant_keys": ["promoted", "eligible", "scanned"],
                "blast_keys": ["promoted"],
                "limit": _MAX_GRADUATE,
            },
        ]

        summaries: list[str] = []
        escalations: list[str] = []
        for step in steps:
            action = harness.solaris_endpoint_action(
                step["name"], step["path"], step["payload"],
                invariant_keys=step["invariant_keys"], client=sc, metric=metric,
            )
            outcome = gate_action(
                action, blast_keys=step["blast_keys"],
                invariant_keys=step["invariant_keys"], limit=step["limit"])
            summaries.append(outcome["summary"])
            if outcome["escalation"]:
                escalations.append(outcome["escalation"])

        # Trendline: record a quality snapshot after every pass (append-only
        # metric, not a mutation — no gate needed). Best-effort.
        try:
            sc._post("/api/admin/kg/quality/snapshot", {})
        except Exception as exc:  # noqa: BLE001
            log.debug("kg_curation: snapshot failed: %s", exc)

        # Report: quiet on a fully-clean run, speak up on action or escalation.
        acted = any("applied" in s or "ESCALATED" in s for s in summaries)
        if acted or escalations:
            try:
                slack = _load_module("tools/portfolio/slack_client.py", "slack_client")
                if getattr(slack, "_BOT_TOKEN", None):
                    body = ":broom: *KG curation* — " + "; ".join(summaries)
                    slack.send("kg-flywheel", body, persona="mithrandir")
                    for esc in escalations:
                        slack.send("escalations", ":warning: " + esc, persona="mithrandir")
            except Exception as exc:  # noqa: BLE001
                log.debug("kg_curation: slack report failed: %s", exc)

        summary = "kg_curation: " + "; ".join(summaries)
        log.info(summary)
        return self._ok(task, summary, elapsed_ms=int((time.time() - t0) * 1000),
                        worker_name="kg_curation_worker")
