# VizuAI — Objectives

> 🧠 [Hub](README.md) · [Variables](brain.yaml) · [Project overview](project.md)

Goals and success criteria for VizuAI. Update this file as priorities shift.

## Primary goals

1. **Fast insight** — users upload or paste data and get a useful chart in under 30 seconds.
2. **AI-assisted design** — the system suggests chart types, colors, and labels based on data shape and user intent.
3. **Agent-friendly codebase** — brAIn navigation so coding agents find the right file without full-repo scans.

## Success criteria

| Criterion | Target |
|---|---|
| Time to first chart | < 30 s from data upload |
| Chart type accuracy | AI picks a sensible default ≥ 80% of the time |
| Agent lookup cost | < 20% of full-scan tokens via hub navigation |

## Current priorities

1. Define data model and chart types.
2. Scaffold the application in [Code/](../Code/README.md).
3. Integrate an LLM for chart-type and styling suggestions.

## Non-goals (v1)

- Multi-user editing
- Custom plugin ecosystem
- Mobile-native apps
