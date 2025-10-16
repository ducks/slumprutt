import type { Coordinate, GeneratedRoute } from './types.js';

/**
 * Calculate approximate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLon = ((coord2.lon - coord1.lon) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate total distance of a route (sum of all segments)
 */
function calculateRouteDistance(points: Coordinate[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(points[i], points[i + 1]);
  }
  return total;
}

/**
 * Generate random waypoints between start and end coordinates
 */
export function generateRandomWaypoints(
  start: Coordinate,
  end: Coordinate,
  count: number = 2
): Coordinate[] {
  const waypoints: Coordinate[] = [];

  for (let i = 0; i < count; i++) {
    // Generate random point in the bounding box between start and end
    const lat = start.lat + Math.random() * (end.lat - start.lat);
    const lon = start.lon + Math.random() * (end.lon - start.lon);

    // Add some randomness to make it more interesting (~1km offset)
    const randomOffset = 0.01;
    waypoints.push({
      lat: lat + (Math.random() - 0.5) * randomOffset,
      lon: lon + (Math.random() - 0.5) * randomOffset,
    });
  }

  return waypoints;
}

/**
 * Generate a loop route by creating waypoints around the start point
 * Attempts to match the target distance by adjusting radius and waypoint count
 */
export function generateLoopWaypoints(
  start: Coordinate,
  targetDistanceKm: number,
  variationIndex: number = 0
): Coordinate[] {
  // Use fewer waypoints to force larger segments and more interesting routes
  const numWaypoints = Math.max(3, Math.min(5, 3 + variationIndex));

  // Make radius larger to create more spread-out routes
  const baseRadius = targetDistanceKm / (2 * Math.PI) * 1.5;

  const waypoints: Coordinate[] = [];
  const latPerKm = 1 / 111; // 1 degree latitude ≈ 111km
  const lonPerKm = 1 / (111 * Math.cos((start.lat * Math.PI) / 180));

  // Use variation index to create distinct directional patterns
  // This helps routes avoid overlapping by favoring different cardinal directions
  const primaryDirection = (variationIndex * (2 * Math.PI)) / 3; // Rotate each route

  for (let i = 0; i < numWaypoints; i++) {
    // Ensure even distribution around the circle
    const baseAngle = (i / numWaypoints) * 2 * Math.PI + primaryDirection;

    // Less random variation to maintain good spread
    const angleVariation = (Math.random() - 0.5) * 0.3;
    const angle = baseAngle + angleVariation;

    // Keep radius fairly consistent but with some variation
    const radiusVariation = 0.8 + Math.random() * 0.4;
    const radius = baseRadius * radiusVariation;

    waypoints.push({
      lat: start.lat + Math.sin(angle) * radius * latPerKm,
      lon: start.lon + Math.cos(angle) * radius * lonPerKm,
    });
  }

  return waypoints;
}

/**
 * Generate multiple random routes based on start/end points
 */
export function generateRoutes(
  start: Coordinate,
  end: Coordinate | undefined,
  numRoutes: number = 3,
  distanceKm: number = 5
): GeneratedRoute[] {
  const routes: GeneratedRoute[] = [];
  const isLoop = !end;

  for (let i = 0; i < numRoutes; i++) {
    let waypoints: Coordinate[];
    let points: Coordinate[];

    if (isLoop) {
      // Generate loop waypoints targeting the specified distance
      waypoints = generateLoopWaypoints(start, distanceKm, i);
      points = [start, ...waypoints, start]; // Return to start
    } else {
      // For point-to-point, generate waypoints that will roughly match distance
      const directDistance = calculateDistance(start, end);
      const extraDistance = distanceKm - directDistance;
      const waypointCount = Math.max(1, Math.floor(extraDistance / 2));

      waypoints = generateRandomWaypoints(start, end, waypointCount);
      points = [start, ...waypoints, end];
    }

    const calculatedDistance = calculateRouteDistance(points);

    routes.push({
      id: i,
      points,
      waypoints,
      isLoop,
      distance: calculatedDistance,
    });
  }

  return routes;
}

/**
 * Get routed paths from OSRM for generated routes
 * This converts straight-line waypoints into actual road-following routes
 */
export async function getRoutedPaths(
  routes: GeneratedRoute[],
  mode: string
): Promise<GeneratedRoute[]> {
  const osrmProfile = mode === 'car' ? 'driving' : mode === 'bike' ? 'cycling' : 'foot';
  const routedRoutes: GeneratedRoute[] = [];

  for (const route of routes) {
    try {
      // Build coordinate string for OSRM (lon,lat format)
      const coords = route.points.map(p => `${p.lon},${p.lat}`).join(';');

      // Call OSRM API with steps for turn-by-turn directions
      // The 'foot' profile already avoids motorways and highways by default
      const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coords}?overview=full&geometries=geojson&steps=true`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        const osrmRoute = data.routes[0];

        // Convert GeoJSON coordinates back to our format
        const routedPoints: Coordinate[] = osrmRoute.geometry.coordinates.map(
          (coord: [number, number]) => ({
            lon: coord[0],
            lat: coord[1],
          })
        );

        // Extract step-by-step directions
        const steps: any[] = [];
        if (osrmRoute.legs) {
          for (const leg of osrmRoute.legs) {
            if (leg.steps) {
              for (const step of leg.steps) {
                steps.push({
                  instruction: step.maneuver?.instruction || `Continue on ${step.name || 'road'}`,
                  distance: step.distance,
                  duration: step.duration,
                });
              }
            }
          }
        }

        routedRoutes.push({
          ...route,
          points: routedPoints,
          distance: osrmRoute.distance / 1000, // Convert meters to km
          duration: osrmRoute.duration / 60, // Convert seconds to minutes
          steps,
        });
      } else {
        // Fallback to original route if OSRM fails
        console.warn(`OSRM routing failed for route ${route.id}, using straight line`);
        routedRoutes.push(route);
      }
    } catch (error) {
      console.error(`Error routing with OSRM for route ${route.id}:`, error);
      // Fallback to original route
      routedRoutes.push(route);
    }
  }

  return routedRoutes;
}
