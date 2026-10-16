export const TAG_COLOR_KEYS = [
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "blue",
  "teal",
  "lime",
  "pink",
  "gray",
] as const;
export type TagColor = (typeof TAG_COLOR_KEYS)[number];

export type Tag = {
  id: number;
  name: string;
  color: TagColor | string;
};

export type TagInput = { name: string; color: TagColor };
