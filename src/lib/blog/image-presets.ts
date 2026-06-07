// 7 presets Image Lab (verbatim master prompt V3). Le serveur valide preset_id
// contre cette liste.

export type ImagePreset = {
  id: string;
  label: string;
  model: string;
  costPerImage: number;
  styleHint: string;
};

export const IMAGE_PRESETS: ImagePreset[] = [
  { id: "icon-lineart", label: "Icon line-art", model: "fal-ai/flux/schnell", costPerImage: 0.003,
    styleHint: "monoline icon illustration on a dark background, thin white strokes, subtle glow, minimal, centered, no text" },
  { id: "warm-cosy", label: "Warm cosy", model: "fal-ai/flux/schnell", costPerImage: 0.003,
    styleHint: "warm cozy editorial photo, natural soft light, terracotta and cream tones, lifestyle, shallow depth of field, no text" },
  { id: "business-editorial", label: "Business editorial", model: "fal-ai/flux/dev", costPerImage: 0.025,
    styleHint: "modern business editorial photo, sharp focus, clean professional composition, neutral palette, no text" },
  { id: "photo-real-premium", label: "Photo-real premium 4K", model: "fal-ai/flux-pro/v1.1", costPerImage: 0.04,
    styleHint: "ultra realistic premium product photography, 4k, luxury lifestyle, cinematic lighting, high detail, no text" },
  { id: "abstract-minimal", label: "Abstract minimal", model: "fal-ai/flux/schnell", costPerImage: 0.003,
    styleHint: "abstract minimal geometric shapes, soft muted palette, conceptual, lots of negative space, no text" },
  { id: "symbolic-icon", label: "Symbolic icon studio", model: "fal-ai/flux/schnell", costPerImage: 0.003,
    styleHint: "single centered object, clean studio lighting, plain background, conceptual still life, no text" },
  { id: "vibrant-flat", label: "Vibrant flat illustration", model: "fal-ai/flux/dev", costPerImage: 0.025,
    styleHint: "flat vector illustration, vibrant bold colors, friendly modern style, clean shapes, no text" },
];

export function getPreset(id: string): ImagePreset | null {
  return IMAGE_PRESETS.find((p) => p.id === id) || null;
}

const ALLOWED_CUSTOM_MODELS = ["fal-ai/flux/schnell", "fal-ai/flux/dev", "fal-ai/flux-pro/v1.1", "fal-ai/flux-pro"];
export function isAllowedModel(m: string): boolean {
  return ALLOWED_CUSTOM_MODELS.includes(m);
}
