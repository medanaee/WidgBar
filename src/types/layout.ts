export enum BarHeight {
  Medium = 36,
  Large = 48,
}

export type Theme = "light" | "dark" | "system";

export interface Settings {
  theme: Theme;
  language: string;
  barHeight: BarHeight;
  snapMargin?: number;
  barAnimate?: boolean;
  widgetBgOpacity?: number;
  barBgOpacity?: number;
}

export interface BarWidget {
  id: string;
  type: string;
}

export interface DesktopWidget {
  id: string;
  type: string;
  name?: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export type BarJustify = "start" | "end" | "center" | "space-between" | "space-around";

export interface BarSection {
  id: string;
  name: string;
  widgets: BarWidget[];
  widgetSpacing?: number;
}

export interface Monitor {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  is_primary: boolean;
  scale_factor?: number;
  has_bar: boolean;
  has_widget_area: boolean;
  barSections?: BarSection[];
  barJustify?: BarJustify;
  barSectionSpacing?: number;
  widgetArea: DesktopWidget[];
  is_disconnected?: boolean;
  isEditMode?: boolean;
  showMainWindowButton?: boolean;
  barSeparator?: "none" | "line" | "dot";
  borrowBarLayoutFrom?: string;
  borrowAreaLayoutFrom?: string;
}

export interface LayoutData {
  monitors: Monitor[];
}

// Represents the parsed global state format inside our frontend
export type LayoutsRecord = Record<string, LayoutData>;