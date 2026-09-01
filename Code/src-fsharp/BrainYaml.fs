module BrainYaml

open System
open Types

let private trimQuotes (s: string) =
    let t = s.Trim()

    if t.StartsWith("\"") && t.EndsWith("\"") then
        t.Substring(1, t.Length - 2)
    else
        t

let private parseSimpleYaml (content: string) =
    let mutable name = ""
    let mutable purpose: string option = None
    let mutable parent: string option = None
    let children = ResizeArray<string>()
    let mutable files = Map.empty
    let mutable whenToRead = Map.empty
    let mutable links = Map.empty

    let mutable section = ""
    let mutable indent = 0

    for rawLine in content.Split('\n') do
        let line = rawLine.TrimEnd('\r')

        if not (line.TrimStart().StartsWith("#")) && not (String.IsNullOrWhiteSpace line) then
            let trimmed = line.TrimStart()
            let currentIndent = line.Length - trimmed.Length

            if trimmed.EndsWith(":") && not (trimmed.Contains(": ")) then
                section <- trimmed.TrimEnd(':')
                indent <- currentIndent
            elif trimmed.Contains(": ") && currentIndent <= indent + 2 then
                let parts = trimmed.Split(":", 2)
                let key = parts.[0].Trim()
                let value = trimQuotes (parts.[1].Trim())

                match section with
                | "" ->
                    match key with
                    | "name" -> name <- value
                    | "purpose" -> purpose <- Some value
                    | "parent" -> parent <- Some value
                    | _ -> ()
                | "children" -> ()
                | "files" -> files <- files.Add(key, value)
                | "when_to_read" -> whenToRead <- whenToRead.Add(key, value)
                | "links" -> links <- links.Add(key, value)
                | _ -> ()
            elif section = "children" && trimmed.StartsWith("- ") then
                children.Add(trimmed.Substring(2).Trim())
            elif section = "files" && trimmed.Contains(": ") then
                let parts = trimmed.Split(":", 2)
                files <- files.Add(parts.[0].Trim(), trimQuotes (parts.[1].Trim()))
            elif section = "when_to_read" && trimmed.Contains(": ") then
                let parts = trimmed.Split(":", 2)
                whenToRead <- whenToRead.Add(parts.[0].Trim(), trimQuotes (parts.[1].Trim()))
            elif section = "links" && trimmed.Contains(": ") then
                let parts = trimmed.Split(":", 2)
                links <- links.Add(parts.[0].Trim(), trimQuotes (parts.[1].Trim()))

    name, purpose, parent, children |> Seq.toList, files, whenToRead, links

let parseBrainYaml (relativePath: string) (content: string) =
    let name, purpose, parent, children, files, whenToRead, links =
        parseSimpleYaml content

    { name = if String.IsNullOrEmpty name then relativePath else name
      purpose = purpose
      parent = parent
      children = children
      files = files
      whenToRead = whenToRead
      links = links
      yamlPath = Some relativePath }

let isBrainYaml (path: string) =
    path.EndsWith("brain.yaml") || path.EndsWith("brain.yml")

let suggestLinks (node: BrainNode) (hyperlinks: HyperLink list) =
    let folderPrefix =
        match node.yamlPath with
        | Some p ->
            let dir = p.Replace("brain.yaml", "").Replace("brain.yml", "")
            if dir.EndsWith("/") then dir else dir + "/"
        | None -> ""

    hyperlinks
    |> List.filter (fun l ->
        l.resolved
        && l.source.StartsWith(folderPrefix)
        && not (node.links.ContainsKey l.label))
    |> List.fold
        (fun acc link ->
            let key =
                if String.IsNullOrWhiteSpace link.label then
                    link.target
                else
                    link.label

            acc |> Map.add key link.target)
        node.links

let formatLinksSection (links: Map<string, string>) =
    if Map.isEmpty links then
        "links: {}"
    else
        let lines =
            links
            |> Map.toList
            |> List.sortBy fst
            |> List.map (fun (k, v) -> $"  \"{k}\": \"{v}\"")

        "links:\n" + String.concat "\n" lines

let updateYamlLinks (content: string) (newLinks: Map<string, string>) =
    let linkStart = content.IndexOf("links:")

    if linkStart < 0 then
        content + "\n" + formatLinksSection newLinks
    else
        let before = content.Substring(0, linkStart)
        let afterSection = content.Substring(linkStart)
        let nextSectionIdx = afterSection.IndexOf("\n", afterSection.IndexOf('\n') + 1)

        let rest =
            if nextSectionIdx > 0 then
                let remaining = afterSection.Substring(nextSectionIdx)

                let lines = remaining.Split('\n')

                lines
                |> Array.skipWhile (fun l ->
                    let t = l.TrimStart()
                    t.StartsWith("\"") || t.StartsWith("-") || t.Contains(": "))
                |> String.concat "\n"
            else
                ""

        before + formatLinksSection newLinks + "\n" + rest
