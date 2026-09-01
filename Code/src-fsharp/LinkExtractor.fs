module LinkExtractor

open System
open System.Text.RegularExpressions
open Types

let private mdLinkRegex =
    Regex(@"\[([^\]]*)\]\(([^)]+)\)", RegexOptions.Compiled)

let private hubLinkRegex =
    Regex(@"🧠\s*\[([^\]]*)\]\(([^)]+)\)", RegexOptions.Compiled)

let private wikiLinkRegex =
    Regex(@"\[\[([^\]]+)\]\]", RegexOptions.Compiled)

let isExternal (target: string) =
    target.StartsWith("http://")
    || target.StartsWith("https://")
    || target.StartsWith("mailto:")
    || target.StartsWith("#")

let normalizeTarget (sourcePath: string) (target: string) =
    if isExternal target then
        target
    else
        let clean =
            target.Split('#').[0].Split('?').[0].Trim()

        if String.IsNullOrWhiteSpace clean then
            ""
        elif clean.StartsWith("/") then
            clean.TrimStart('/')
        else
            let sourceDir =
                let idx = sourcePath.LastIndexOf('/')

                if idx < 0 then "" else sourcePath.Substring(0, idx)

            if String.IsNullOrEmpty sourceDir then
                clean
            else
                $"{sourceDir}/{clean}"

let private linesToWiki (source: string) (content: string) =
    let lines = content.Split('\n')

    lines
    |> Array.mapi (fun lineIdx line ->
        wikiLinkRegex.Matches(line)
        |> Seq.cast<Match>
        |> Seq.map (fun m ->
            let target = m.Groups.[1].Value.Trim()

            { source = source
              target = target
              label = target
              line = lineIdx + 1
              resolved = false })
        |> Seq.toList)
    |> Array.toList
    |> List.collect id

let private extractFromRegex (source: string) (content: string) (regex: Regex) (getTarget: Group -> string) =
    let lines = content.Split('\n')

    lines
    |> Array.mapi (fun lineIdx line ->
        regex.Matches(line)
        |> Seq.cast<Match>
        |> Seq.map (fun m ->
            let label = m.Groups.[1].Value
            let rawTarget = getTarget m.Groups.[2]
            let target = normalizeTarget source rawTarget

            if String.IsNullOrWhiteSpace target || isExternal target then
                None
            else
                Some
                    { source = source
                      target = target
                      label = label
                      line = lineIdx + 1
                      resolved = false })
        |> Seq.choose id)
    |> Seq.concat
    |> Seq.toList

let extractFromMarkdown (source: string) (content: string) =
    let standard =
        extractFromRegex source content mdLinkRegex (fun g -> g.Value)

    let hubs =
        extractFromRegex source content hubLinkRegex (fun g -> g.Value)

    let wiki = linesToWiki source content

    standard @ hubs @ wiki

let private withVariants (path: string) =
    [ path
      path.Replace("\\", "/")
      if path.EndsWith(".md") then path else path + ".md"
      if path.EndsWith("/README.md") then path.Replace("/README.md", "") else path ]

let resolveLinks (files: ScannedFile list) (links: HyperLink list) =
    let fileSet =
        files
        |> List.map (fun f -> f.relativePath)
        |> Set.ofList

    links
    |> List.map (fun link ->
        let candidates = withVariants link.target

        let resolved =
            candidates
            |> List.exists (fun c -> fileSet.Contains c)

        let finalTarget =
            candidates
            |> List.tryFind (fun c -> fileSet.Contains c)
            |> Option.defaultValue link.target

        { link with
            target = finalTarget
            resolved = resolved })
