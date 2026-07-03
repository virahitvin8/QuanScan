export interface BoundingBox {
  ymin: number; // 0 to 100
  xmin: number; // 0 to 100
  ymax: number; // 0 to 100
  xmax: number; // 0 to 100
}

export interface DetectedItem {
  id: string;
  label: string;
  count: number;
  box_2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-100
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface ScanResult {
  id: string;
  title: string;
  timestamp: number;
  imageUrl: string;
  detectedCategory: string;
  totalCount: number;
  items: DetectedItem[];
  sceneDescription?: string;
  notes?: string;
}

export type ActiveTab = 'scan' | 'history' | 'dashboard';
