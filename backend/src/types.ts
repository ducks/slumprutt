export interface Coordinate {
  lat: number;
  lon: number;
}

export type TransportMode = 'walk' | 'bike' | 'car';

export interface RouteRequest {
  start: Coordinate;
  end?: Coordinate;
  mode?: TransportMode;
  numRoutes?: number;
  distanceKm?: number; // Target distance for the route (especially useful for loops)
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

export interface GeneratedRoute {
  id: number;
  points: Coordinate[];
  waypoints: Coordinate[];
  isLoop: boolean;
  distance?: number;
  duration?: number;
  steps?: RouteStep[];
}

export interface RouteResponse {
  routes: GeneratedRoute[];
  mode: TransportMode;
}
