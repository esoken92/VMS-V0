# VMS Offline — dual-artifact Rust build

The offline artifact of VMS: a single-PC, air-gapped build for factory
floors and remote sites with no usable server or network (spec item 255b /
Phase 6, items 300–313 in `docs/MASTER_EXECUTION_PROMPT.md`).

- `crates/vms-offline-server` — Axum + SQLite (rusqlite, bundled). Implements
  the same `/api/v1` REST contract as the Next.js backend, with the same
  `{data: …}` / `{error: {code, message}}` envelope and the same role /
  movement-type permission matrices.
- `crates/vms-offline-tauri` — Tauri v2 shell. Wraps the SAME Next.js
  frontend; the UI is never forked.

**Architecture, run instructions, and the honest route-parity matrix live in
[`docs/OFFLINE-APP.md`](../docs/OFFLINE-APP.md).** Read that first.

Quick start:

```bash
cargo run -p vms-offline-server -- --seed   # first run: demo data
cargo run -p vms-offline-server            # serves http://127.0.0.1:3300
cargo test                                # ledger invariant + permissions
```

Zero outbound network calls at runtime. The SQLite file is the only state.
