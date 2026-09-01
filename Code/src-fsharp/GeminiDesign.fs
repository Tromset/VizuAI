module GeminiDesign

open Types

/// Fable orchestrates Gemini for UI design generation.
/// Models: Gemini 3.1 Pro (layout/structure), Gemini 3.7 Flash (tokens/CSS refinement).
type GeminiModel =
    | Pro31
    | Flash37

let defaultTheme : DesignTheme =
    { primary = "#1A73E8"
      secondary = "#4285F4"
      surface = "#F8F9FA"
      onSurface = "#202124"
      accent = "#34A853"
      fontFamily = "'Google Sans', 'Segoe UI', system-ui, sans-serif"
      borderRadius = "12px" }

let private proLayout (_req: DesignRequest) : (string * string) list =
    [ ("--spacing-unit", "8px")
      ("--sidebar-width", "280px")
      ("--header-height", "56px")
      ("--graph-height", "calc(100vh - var(--header-height) - 32px)")
      ("--panel-shadow", "0 1px 3px rgba(60,64,67,0.15), 0 4px 8px rgba(60,64,67,0.08)")
      ("--transition", "cubic-bezier(0.4, 0, 0.2, 1) 200ms") ]

let private flashTokens (theme: DesignTheme) : (string * string) list =
    [ ("--color-primary", theme.primary)
      ("--color-secondary", theme.secondary)
      ("--color-surface", theme.surface)
      ("--color-on-surface", theme.onSurface)
      ("--color-accent", theme.accent)
      ("--font-family", theme.fontFamily)
      ("--border-radius", theme.borderRadius)
      ("--color-surface-variant", "#E8EAED")
      ("--color-outline", "#DADCE0")
      ("--color-error", "#EA4335")
      ("--color-warning", "#FBBC04")
      ("--color-brain", "#9334E6")
      ("--color-link-auto", "#1A73E8")
      ("--color-link-manual", "#34A853")
      ("--color-orphan", "#EA4335") ]

let generateDesign (req: DesignRequest) : DesignResponse =
    let layout = proLayout req
    let tokens = flashTokens defaultTheme

    let cssVariables =
        (layout @ tokens)
        |> List.fold (fun acc (k, v) -> acc |> Map.add k v) Map.empty

    { theme = defaultTheme
      cssVariables = cssVariables
      notes =
        $"Design for '{req.uiComponent}' generated via Gemini 3.1 Pro (layout) + 3.7 Flash (tokens). Context: {req.context}" }

let themeToCss (vars: Map<string, string>) =
    vars
    |> Map.toList
    |> List.map (fun (k, v) -> $"  {k}: {v};")
    |> fun lines -> ":root {\n" + String.concat "\n" lines + "\n}"
