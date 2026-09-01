module GraphBuilder

open Types

let private nodeKind (file: ScannedFile) =
    match file.kind with
    | BrainYaml -> "brain"
    | Markdown -> "markdown"
    | Other -> "other"

let buildGraph (files: ScannedFile list) (links: HyperLink list) (brainNodes: BrainNode list) =
    let nodes =
        files
        |> List.map (fun f ->
            let isHub =
                f.kind = BrainYaml
                || f.relativePath.EndsWith("README.md")

            { id = f.relativePath
              label =
                if f.relativePath.EndsWith("README.md") then
                    let parts = f.relativePath.Replace("/README.md", "").Split('/')
                    let s = parts.[parts.Length - 1]
                    if s = "" then "root" else s
                elif f.kind = BrainYaml then "🧠 " + f.relativePath
                else
                    let parts = f.relativePath.Split('/')
                    parts.[parts.Length - 1]
              kind = nodeKind f
              hub = isHub })

    let edges =
        links
        |> List.filter (fun l -> l.resolved)
        |> List.map (fun l ->
            { source = l.source
              target = l.target
              label = l.label
              auto = true })

    let brainEdges =
        brainNodes
        |> List.collect (fun n ->
            match n.yamlPath with
            | None -> []
            | Some src ->
                let dir = src.Replace("brain.yaml", "").Replace("brain.yml", "")
                let prefix = if dir.EndsWith("/") then dir else dir + "/"

                n.children
                |> List.map (fun child ->
                    let cp = prefix + child.TrimEnd('/')

                    { source = src
                      target = cp + "README.md"
                      label = "child"
                      auto = false }))

    nodes, edges @ brainEdges

let findOrphans (files: ScannedFile list) (links: HyperLink list) =
    let linked =
        links
        |> List.filter (fun l -> l.resolved)
        |> List.collect (fun l -> [ l.source; l.target ])
        |> Set.ofList

    let hubs =
        files
        |> List.filter (fun f -> f.relativePath.EndsWith("README.md") || f.kind = BrainYaml)
        |> List.map (fun f -> f.relativePath)
        |> Set.ofList

    files
    |> List.filter (fun f ->
        f.kind = Markdown
        && not (linked.Contains f.relativePath)
        && not (hubs.Contains f.relativePath)
        && f.relativePath <> "README.md")
    |> List.map (fun f -> f.relativePath)
