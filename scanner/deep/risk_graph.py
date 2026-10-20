"""
Scanly Scanner Engine - Phase F8 Security Relationship Graph Builder
Constructs a bounded, deterministic in-memory relationship graph connecting
discovered entities (endpoints, APIs, auth surfaces, cloud providers, CDN, origin, documents)
with observed findings and defensive controls.
"""
from typing import List, Dict, Any, Optional, Set, Tuple
from urllib.parse import urlparse

from .finding_normalizer import SecurityEvidence


def build_security_graph(
    evidence_list: List[SecurityEvidence],
    scan_metadata: Optional[Dict[str, Any]] = None,
    max_nodes: int = 250,
    max_edges: int = 500,
) -> Dict[str, Any]:
    """
    Constructs an in-memory security relationship graph from scan evidence and metadata.
    Enforces strict node/edge bounds, deterministic ordering, and irreversible masking.
    """
    metadata = scan_metadata or {}
    domain = metadata.get("domain") or "target.website"
    target_ip = metadata.get("target_ip")

    nodes_dict: Dict[str, Dict[str, Any]] = {}
    edges_list: List[Dict[str, Any]] = []
    seen_edge_signatures: Set[str] = set()
    graph_truncated = False

    def add_node(node_id: str, node_type: str, label: str, phase: Optional[str] = None, meta: Optional[Dict[str, Any]] = None) -> bool:
        nonlocal graph_truncated
        if node_id in nodes_dict:
            return True
        if len(nodes_dict) >= max_nodes:
            graph_truncated = True
            return False
        nodes_dict[node_id] = {
            "id": node_id,
            "type": node_type,
            "label": label,
            "phase": phase,
            "finding_ids": [],
            "metadata": meta or {},
        }
        return True

    def add_edge(source: str, target: str, relationship: str, confidence: str = "HIGH", label: Optional[str] = None) -> bool:
        nonlocal graph_truncated
        if source not in nodes_dict or target not in nodes_dict:
            return False
        sig = f"{source}->{relationship}->{target}"
        if sig in seen_edge_signatures:
            return True
        if len(edges_list) >= max_edges:
            graph_truncated = True
            return False
        seen_edge_signatures.add(sig)
        edges_list.append({
            "source": source,
            "target": target,
            "relationship": relationship,
            "confidence": confidence,
            "label": label or relationship.lower().replace("_", " "),
        })
        return True

    # 1. Root Entity: Website
    root_id = "node:website:root"
    add_node(root_id, "website", f"https://{domain}", phase="F1", meta={"domain": domain})

    # 2. Infrastructure Layer: IP, CDN, Cloud, Origin
    infra_meta = metadata.get("infrastructure_security") or {}
    cdn_info = infra_meta.get("cdn") or {}
    cloud_info = infra_meta.get("cloud_provider") or {}
    origin_info = infra_meta.get("origin_exposure") or {}

    if target_ip:
        ip_node_id = f"node:ip:{target_ip}"
        if add_node(ip_node_id, "ip", target_ip, phase="F2"):
            add_edge(root_id, ip_node_id, "RESOLVES_TO", "HIGH")

    if cdn_info.get("detected"):
        cdn_name = cdn_info.get("provider") or "CDN"
        cdn_node_id = f"node:cdn:{cdn_name.lower()}"
        if add_node(cdn_node_id, "cdn", cdn_name, phase="F6", meta=cdn_info):
            add_edge(root_id, cdn_node_id, "PROTECTED_BY", "HIGH")

    if cloud_info.get("detected"):
        cloud_name = cloud_info.get("provider") or "Cloud"
        cloud_node_id = f"node:cloud:{cloud_name.lower()}"
        if add_node(cloud_node_id, "cloud_provider", cloud_name, phase="F6", meta=cloud_info):
            add_edge(root_id, cloud_node_id, "HOSTED_ON", "HIGH")

    if origin_info.get("origin_exposed"):
        origin_ip = origin_info.get("detected_origin_ip") or "Unshielded Origin"
        origin_node_id = f"node:origin:{origin_ip}"
        if add_node(origin_node_id, "origin", f"Origin: {origin_ip}", phase="F6", meta=origin_info):
            add_edge(root_id, origin_node_id, "EXPOSES_ORIGIN", "MEDIUM")

    # 3. Technologies Layer
    techs = metadata.get("technologies") or []
    for t in techs[:10]:
        t_name = t.get("name") if isinstance(t, dict) else str(t)
        t_id = f"node:tech:{t_name.lower()}"
        if add_node(t_id, "technology", t_name, phase="F1"):
            add_edge(root_id, t_id, "USES_TECHNOLOGY", "HIGH")

    # 3.5 Third-Party Scripts Layer
    tp_scripts = metadata.get("third_party_scripts") or []
    for tp in tp_scripts[:10]:
        tp_name = tp.get("name") or tp.get("domain") if isinstance(tp, dict) else str(tp)
        tp_id = f"node:third_party:{tp_name.lower()}"
        if add_node(tp_id, "third_party", tp_name, phase="F1", meta=tp if isinstance(tp, dict) else {}):
            add_edge(root_id, tp_id, "INCLUDES_SCRIPT", "HIGH")

    # 4. Map Discovered Surfaces & Connect with Evidence
    asset_node_map: Dict[str, str] = {}

    for ev in evidence_list:
        asset_str = ev.asset or ev.url
        if not asset_str:
            target_parent = root_id
        else:
            if asset_str in asset_node_map:
                target_parent = asset_node_map[asset_str]
            else:
                # Classify node type based on canonical category and asset string
                node_type = "endpoint"
                if ev.canonical_category == "API_SURFACE" or "/api" in asset_str:
                    node_type = "api"
                elif ev.canonical_category == "ADMIN_SURFACE" or "/admin" in asset_str:
                    node_type = "admin_surface"
                elif ev.canonical_category == "AUTHENTICATION_SURFACE" or "login" in asset_str or "auth" in asset_str:
                    node_type = "auth_surface"
                elif ev.canonical_category == "DOCUMENT_EXPOSURE" or any(asset_str.endswith(x) for x in (".pdf", ".sql", ".csv", ".dump", ".log")):
                    node_type = "document"
                elif ev.canonical_category == "CLOUD_STORAGE_EXPOSURE":
                    node_type = "storage_bucket"
                elif ev.canonical_category == "TRACKING_SURFACE":
                    node_type = "tracking_service"

                node_id = f"node:{node_type}:{abs(hash(asset_str)) % 100000}"
                label = asset_str
                if len(label) > 40:
                    label = "..." + label[-37:]

                if add_node(node_id, node_type, label, phase=ev.source_phase, meta={"full_path": asset_str}):
                    rel = "SERVES"
                    if node_type == "document":
                        rel = "HOSTS_DOCUMENT"
                    elif node_type == "api":
                        rel = "EXPOSES_API"
                    elif node_type == "tracking_service":
                        rel = "LOADS_TRACKER"
                    add_edge(root_id, node_id, rel, "HIGH")
                    asset_node_map[asset_str] = node_id
                    target_parent = node_id
                else:
                    target_parent = root_id

        # Add Finding node (for critical, high, and medium severity findings)
        if ev.severity in ("critical", "high", "medium"):
            f_node_id = f"node:finding:{ev.finding_id}"
            f_label = ev.title
            if len(f_label) > 35:
                f_label = f_label[:32] + "..."
            if add_node(f_node_id, "finding", f_label, phase=ev.source_phase, meta={
                "severity": ev.severity,
                "check_type": ev.check_type,
                "canonical": ev.canonical_category,
            }):
                if target_parent in nodes_dict:
                    nodes_dict[target_parent]["finding_ids"].append(ev.finding_id)
                add_edge(target_parent, f_node_id, "AFFECTS", ev.confidence, label="affects")

    # Format output
    nodes_list = list(nodes_dict.values())
    nodes_list.sort(key=lambda n: (n["type"], n["id"]))
    edges_list.sort(key=lambda e: (e["source"], e["target"], e["relationship"]))

    return {
        "nodes": nodes_list,
        "edges": edges_list,
        "node_count": len(nodes_list),
        "edge_count": len(edges_list),
        "graph_truncated": graph_truncated,
        "max_nodes_configured": max_nodes,
        "max_edges_configured": max_edges,
    }
