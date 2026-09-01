---
name: brainify
description: Transforms any folder or repository into a brAIn structure optimized for LLM navigation — README.md hubs, brain.yaml variables files, everything in Markdown, relative hyperlinks — and splits files by audience (user docs at the root, agent files in Agents/, machine code in Code/). Use when the user says "brainify", "brAInify", mentions brAIn structure, hubs and brain.yaml files, or asks to reorganize a folder so AI agents can navigate it cheaply.
---

# Brainify — turn a folder into a brAIn

Canonical copy of this skill (same directives, listed on the Agents hub): [Agents/Skill.md](../../../Agents/Skill.md). Follow that file if it is present; otherwise apply everything below.

A brAIn is a folder where a small navigation layer (hubs + variables files) routes an agent straight to the one file it needs, instead of forcing a full scan. Apply the 6 rules and the **audience split** below to the target folder, then verify.

## Audience split (required)

Every file is sorted by **who it talks to**. Do not mix audiences in the same folder.

| Who it talks to | Where it lives | Examples |
|---|---|---|
| The **user** (human reader) | Project **root** (main folder) | Getting started, tutorials, product docs, human-facing README beyond the hub table |
| **Agents** | `Agents/` | Context, objectives, constraints, decisions, tasks, skills, prompts |
| The **machine** | `Code/` | Source, lockfiles, package manifests, compiled configs, scripts the runtime executes |

**Exception — `brain.yaml`:** the folder variables card (rule 6) is navigation, not application code. It lives in **every** folder that has a hub, **including `Code/`**. Do not move a `brain.yaml` into `Agents/` or out of `Code/` just because it is YAML.

Hubs (`README.md`) also exist in every folder (rule 1), including `Agents/` and `Code/`. They are the navigation layer, not user documentation. User-facing prose that is more than a hub table belongs at the root.

Hard constraints:

- Do **not** put getting-started guides, tutorials, or human docs inside `Code/` or `Agents/`.
- Do **not** put agent prompts, objectives, decision logs, or skills at the root or in `Code/`.
- Do **not** put source code at the root or in `Agents/` (except `brain.yaml` as above).

## The 6 rules

1. **Every folder has a hub** — a `README.md`: title + one-line purpose, navigation header (link to parent hub and to the folder's `brain.yaml`), a table of every content file with a one-liner, and links to each subfolder's `README.md`.
2. **Files are connected by hyperlinks** — every content file starts with a navigation header (blockquote linking to the hub, `brain.yaml`, and related siblings). All links are relative Markdown links. No broken links, no orphan files (everything reachable from the root hub).
3. **All content files are Markdown** — convert `.txt`, notes, exported docs to structured `.md`.
4. **Code lives inside Markdown code fences** with a language tag. One `.md` file can hold several fences (e.g. HTML + CSS of one page). When a project uses a real `Code/` tree, keep executable sources as real files in `Code/` (the machine reads them); do not embed application source into Markdown just to satisfy this rule.
5. **MCPs and deep configs stay `.json`** — don't convert machine-consumed config; link it from the folder's hub so it isn't an orphan. Machine configs belong in `Code/` unless they are `brain.yaml`.
6. **Every folder has a `brain.yaml`** — a compact variables card with a `when_to_read` routing table (question → file). This is the key token-saving field. `brain.yaml` is allowed in `Code/`.

### brain.yaml schema

```yaml
# brain.yaml — folder variables (brAIn rule 6)
name: <folder-name>
purpose: "<one line>"
parent: ../brain.yaml          # null at the project root
children: []                   # subfolders, each with its own README.md + brain.yaml
files:
  file.md: "<one-liner>"
when_to_read:                  # routing table: agent question -> file to open
  "<question>": file.md
links: {}                      # optional external references
```

All fields required except `links`.

## Transformation workflow

1. **Inventory** the target folder: list every file and subfolder, note formats, roles, and **audience** (user / agent / machine). Skip hidden directories (`.git/`, `.cursor/`, `node_modules/`...).
2. **Split by audience** (required whenever the folder mixes humans, agents, and machines):
   - Create `Agents/` and `Code/` if they do not exist.
   - Move user-facing documentation to the **root**.
   - Move agent-facing context, skills, and decisions to `Agents/`.
   - Move machine-addressed source and configs to `Code/`.
   - Leave each folder's `brain.yaml` (and hub `README.md`) in place.
   - Sort existing files by role without losing information.
3. **Convert** non-Markdown **content** files to `.md` (rule 3). Keep deep configs as `.json` (rule 5) in `Code/`. Preserve all information.
4. **Create per folder** a `README.md` hub (rule 1) and a `brain.yaml` (rule 6). Write a meaningful `when_to_read` for each folder. Root `when_to_read` should send "how do I run this?" to a root getting-started file, "what are we building?" to `Agents/`, and "where is the source?" to `Code/`.
5. **Wire links** (rule 2): navigation header at the top of every content file, hub tables listing every file, parent/child hub links.
6. **Verify**: every relative Markdown link resolves; every file is reachable from the root hub; no user doc sits in `Code/` or `Agents/`; no agent file sits at the root or in `Code/`; no source file sits at the root or in `Agents/` except `brain.yaml`.
