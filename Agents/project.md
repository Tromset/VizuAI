# VizuAI — Project overview

> 🧠 [Hub](README.md) · [Variables](brain.yaml) · [Objectives](objectives.md)

VizuAI is an AI-assisted data visualization project. It helps users turn raw data into clear, interactive charts and dashboards with minimal manual configuration. The first shipping surface is **brAIn Mapper**, an Electron app that maps brAIn folders.

## Audience layout

Sort files by who they talk to. Full directives: [Skill.md](Skill.md).

| Audience | Folder |
|---|---|
| User | repo root — [getting-started.md](../getting-started.md) |
| Agents | this folder |
| Machine | [Code/](../Code/README.md) (`brain.yaml` excepted) |

## Scope

- **In scope:** data ingestion, chart generation, AI-driven layout and styling suggestions, export and sharing; brAIn folder mapping.
- **Out of scope (for now):** real-time collaboration, enterprise SSO, on-prem deployment.

## Stack

brAIn Mapper: Electron + Fable 5.1 (F#) + Cytoscape.js. Visualization product stack still open. See [objectives.md](objectives.md) and [Code/](../Code/README.md).

## Status

brAIn navigation layer is in place. brAIn Mapper lives under `Code/`. Visualization product remains greenfield.
