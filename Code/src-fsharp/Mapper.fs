module Mapper

open Types
open Scanner
open LinkExtractor
open BrainYaml
open GraphBuilder

let mapFiles (rootPath: string) (entries: (string * string) list) : MapResult =
    let files = scanFromContents rootPath entries

    let allLinks =
        files
        |> List.filter (fun f -> f.kind = Markdown)
        |> List.collect (fun f -> extractFromMarkdown f.relativePath f.content)

    let resolvedLinks = resolveLinks files allLinks

    let brainNodes =
        files
        |> List.filter (fun f -> f.kind = BrainYaml)
        |> List.map (fun f -> parseBrainYaml f.relativePath f.content)

    let graphNodes, graphEdges = buildGraph files resolvedLinks brainNodes

    let updates =
        brainNodes
        |> List.choose (fun node ->
            let suggested = suggestLinks node resolvedLinks

            if Map.count suggested > Map.count node.links then
                node.yamlPath
                |> Option.map (fun p ->
                    { yamlPath = p
                      newLinks = suggested })
            else
                None)

    let folderMap =
        { rootPath = rootPath
          files = files
          hyperlinks = resolvedLinks
          brainNodes = brainNodes
          graphNodes = graphNodes
          graphEdges = graphEdges
          scannedAt = System.DateTime.UtcNow.ToString("o") }

    { map = folderMap
      updates = updates
      orphanFiles = findOrphans files resolvedLinks
      brokenLinks = resolvedLinks |> List.filter (fun l -> not l.resolved) }

let applyLinkUpdatesToContents (updates: LinkUpdate list) (contents: Map<string, string>) =
    updates
    |> List.fold
        (fun acc update ->
            match Map.tryFind update.yamlPath acc with
            | Some content ->
                let updated = updateYamlLinks content update.newLinks
                acc |> Map.add update.yamlPath updated
            | None -> acc)
        contents
