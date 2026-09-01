module Scanner

open Types
open BrainYaml

let classifyFile (path: string) =
    if isBrainYaml path then BrainYaml
    elif path.EndsWith(".md") then Markdown
    else Other

let scanFromContents (rootPath: string) (entries: (string * string) list) =
    entries
    |> List.choose (fun (relPath, content) ->
        let kind = classifyFile relPath

        if kind = Other then
            None
        else
            Some
                { relativePath = relPath
                  absolutePath = rootPath + "/" + relPath
                  kind = kind
                  content = content })
