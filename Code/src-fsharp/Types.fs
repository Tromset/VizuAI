module Types

open System

type FileKind =
    | Markdown
    | BrainYaml
    | Other

type ScannedFile =
    { relativePath: string
      absolutePath: string
      kind: FileKind
      content: string }

type HyperLink =
    { source: string
      target: string
      label: string
      line: int
      resolved: bool }

type BrainNode =
    { name: string
      purpose: string option
      parent: string option
      children: string list
      files: Map<string, string>
      whenToRead: Map<string, string>
      links: Map<string, string>
      yamlPath: string option }

type GraphNode =
    { id: string
      label: string
      kind: string
      hub: bool }

type GraphEdge =
    { source: string
      target: string
      label: string
      auto: bool }

type FolderMap =
    { rootPath: string
      files: ScannedFile list
      hyperlinks: HyperLink list
      brainNodes: BrainNode list
      graphNodes: GraphNode list
      graphEdges: GraphEdge list
      scannedAt: string }

type LinkUpdate =
    { yamlPath: string
      newLinks: Map<string, string> }

type MapResult =
    { map: FolderMap
      updates: LinkUpdate list
      orphanFiles: string list
      brokenLinks: HyperLink list }

type DesignTheme =
    { primary: string
      secondary: string
      surface: string
      onSurface: string
      accent: string
      fontFamily: string
      borderRadius: string }

type DesignRequest =
    { context: string
      uiComponent: string
      constraints: string list }

type DesignResponse =
    { theme: DesignTheme
      cssVariables: Map<string, string>
      notes: string }
