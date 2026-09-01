# VizuAI — AI-powered data visualization

> 🧠 [Variables](brain.yaml)

VizuAI is an AI-assisted visualization project. Files are split by **who they talk to**, so humans, agents, and the runtime each have one place to look.

## Who a file talks to

| Audience | Folder | What belongs there |
|---|---|---|
| **User** (you) | This folder (the repo root) | Documentation: this hub, [getting-started.md](getting-started.md) |
| **Agents** | [Agents/](Agents/README.md) | Context, objectives, decisions, and the [brainify skill](Agents/Skill.md) |
| **Machine** | [Code/](Code/README.md) | Application source and configs the runtime executes |

`brain.yaml` is the exception: it is the navigation card for a folder (brAIn rule 6), so it lives next to every hub — including inside `Code/` — and is not treated as application code.

## Files

| File | What it contains |
|---|---|
| [getting-started.md](getting-started.md) | Install, run, and use brAIn Mapper |
| [brain.yaml](brain.yaml) | Root routing table and folder index |

## Subfolders

- [Agents/](Agents/README.md) — files written for agents
- [Code/](Code/README.md) — files written for the machine
