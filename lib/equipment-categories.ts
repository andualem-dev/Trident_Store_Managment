export const EQUIPMENT_CATEGORIES = [
  "Camera",
  "Lens",
  "Tripod",
  "Lighting",
  "Audio",
  "Other",
] as const;

export type EquipmentCategoryPreset = (typeof EQUIPMENT_CATEGORIES)[number];
