module Program

open Fable.Core.JsInterop
open Types
open Mapper
open GeminiDesign

let private nodeToJson (n: GraphNode) =
    createObj
        [ "id" ==> n.id
          "label" ==> n.label
          "kind" ==> n.kind
          "hub" ==> n.hub ]

let private edgeToJson (e: GraphEdge) =
    createObj
        [ "source" ==> e.source
          "target" ==> e.target
          "label" ==> e.label
          "auto" ==> e.auto ]

let private fileToJson (f: ScannedFile) =
    let kindStr =
        match f.kind with
        | Markdown -> "markdown"
        | BrainYaml -> "brain"
        | Other -> "other"

    createObj [ "path" ==> f.relativePath; "kind" ==> kindStr ]

let private brainToJson (b: BrainNode) =
    createObj
        [ "name" ==> b.name
          "purpose" ==> (b.purpose |> Option.defaultValue "")
          "yamlPath" ==> (b.yamlPath |> Option.defaultValue "")
          "children" ==> (b.children |> List.toArray)
          "fileCount" ==> (Map.count b.files) ]

let private brokenToJson (l: HyperLink) =
    createObj
        [ "source" ==> l.source
          "target" ==> l.target
          "line" ==> l.line ]

let private updateToJson (u: LinkUpdate) =
    createObj
        [ "yamlPath" ==> u.yamlPath
          "linkCount" ==> (Map.count u.newLinks)
          "newLinks" ==>
            (u.newLinks
             |> Map.toList
             |> List.map (fun (k, v) -> createObj [ "key" ==> k; "value" ==> v ])
             |> List.toArray) ]

let encodeMapResult (result: MapResult) =
    let resolved =
        result.map.hyperlinks |> List.filter (fun l -> l.resolved) |> List.length

    createObj
        [ "rootPath" ==> result.map.rootPath
          "scannedAt" ==> result.map.scannedAt
          "fileCount" ==> result.map.files.Length
          "linkCount" ==> result.map.hyperlinks.Length
          "resolvedCount" ==> resolved
          "brokenCount" ==> result.brokenLinks.Length
          "orphanCount" ==> result.orphanFiles.Length
          "updateCount" ==> result.updates.Length
          "nodes" ==> (result.map.graphNodes |> List.map nodeToJson |> List.toArray)
          "edges" ==> (result.map.graphEdges |> List.map edgeToJson |> List.toArray)
          "files" ==> (result.map.files |> List.map fileToJson |> List.toArray)
          "brainNodes" ==> (result.map.brainNodes |> List.map brainToJson |> List.toArray)
          "orphans" ==> (result.orphanFiles |> List.toArray)
          "brokenLinks" ==> (result.brokenLinks |> List.map brokenToJson |> List.toArray)
          "updates" ==> (result.updates |> List.map updateToJson |> List.toArray) ]

let encodeDesign (design: DesignResponse) =
    let cssVars =
        design.cssVariables
        |> Map.toList
        |> List.map (fun (k, v) -> k ==> v)
        |> List.toArray
        |> createObj

    createObj
        [ "theme" ==>
            createObj
                [ "primary" ==> design.theme.primary
                  "secondary" ==> design.theme.secondary
                  "surface" ==> design.theme.surface
                  "onSurface" ==> design.theme.onSurface
                  "accent" ==> design.theme.accent
                  "fontFamily" ==> design.theme.fontFamily
                  "borderRadius" ==> design.theme.borderRadius ]
          "cssVariables" ==> cssVars
          "css" ==> (themeToCss design.cssVariables)
          "notes" ==> design.notes ]

let mapFolder (rootPath: string) (files: (string * string) array) =
    let entries = files |> Array.toList
    mapFiles rootPath entries |> encodeMapResult

let getDesignTheme () =
    let req =
        { context = "brAIn folder mapper — agentic navigation tool"
          uiComponent = "main-layout"
          constraints =
            [ "dark-on-light"
              "graph-centric"
              "accessible contrast"
              "Gemini Material aesthetic" ] }

    generateDesign req |> encodeDesign

let exports =
    createObj
        [ "mapFolder" ==> mapFolder
          "getDesignTheme" ==> (fun () -> getDesignTheme ()) ]
