import { geoServices, type GeocodeResult, type RouteResult, type OverpassElement } from '../api/geoServices';
import { getBoundingBox, pointToSegmentDistance } from '../utils/geoUtils';

export interface ProcessedTrip {
  routeName: string;
  distanceKm: number;
  durationMinutes: number;
  crossings: OverpassElement[];
  routeCoordinates: [number, number][]; // [lon, lat]
  hasBridge: boolean;
  hasTunnel: boolean;
  maxElevation: number;
  minElevation: number;
  maxBridgeLength: number;
  startCountry?: string;
  endCountry?: string;
  startIsland?: string;
  endIsland?: string;
}

export class TripEngine {
  /**
   * Maximum distance (in meters) a crossing can be from the route polyline
   * to be considered "on" the route.
   * 150m is a safe buffer for GPS inaccuracies and wide intersections.
   */
  private static MAX_CROSSING_DISTANCE_METERS = 150;

  /**
   * Orchestrates the entire trip planning process.
   * 1. Gets route from OSRM
   * 2. Calculates bounding box
   * 3. Fetches crossings from Overpass
   * 4. Filters crossings that are actually on the route
   */
  static async planTrip(start: GeocodeResult, end: GeocodeResult): Promise<ProcessedTrip> {
    try {
      // 1. Get driving route
      const startCoords: [number, number] = [parseFloat(start.lon), parseFloat(start.lat)];
      const endCoords: [number, number] = [parseFloat(end.lon), parseFloat(end.lat)];
      
      const routeData = await geoServices.getRoute(startCoords, endCoords);
      
      if (!routeData.routes || routeData.routes.length === 0) {
        throw new Error("Impossible de trouver un itinéraire entre ces deux points.");
      }

      const primaryRoute = routeData.routes[0];
      const routeCoordinates = primaryRoute.geometry.coordinates; // [lon, lat][]

      // Prevent absurdly large queries that will crash the Overpass API
      if (primaryRoute.distance > 500000) { // 500km
        throw new Error("Ce trajet est trop long pour être analysé (maximum 500 km).");
      }

      // 2. Calculate bounding box for the route with a 500m padding (reduced from 2km to prevent timeouts)
      const bbox = getBoundingBox(routeCoordinates, 500);

      // 3. Fetch all crossings within that bounding box
      const overpassData = await geoServices.getCrossingsInBBox(bbox);
      const allCrossings = overpassData.elements || [];

      // 4. Filter crossings that are actually ON the route
      const validCrossings = this.filterCrossingsOnRoute(allCrossings, routeCoordinates);

      // 5. Fetch infrastructure (bridges/tunnels)
      let hasBridge = false;
      let hasTunnel = false;
      let maxBridgeLength = 0;

      // Only query infrastructure for reasonable distances to prevent Overpass timeouts
      if (primaryRoute.distance < 50000) { // < 50km
        const infraData = await geoServices.getInfrastructureInBBox(bbox);
        hasBridge = infraData.elements.some(e => e.tags?.bridge);
        hasTunnel = infraData.elements.some(e => e.tags?.tunnel);

        for (const element of infraData.elements) {
          if (element.tags?.bridge && element.geometry) {
            // Calculate length of the way
            let length = 0;
            for (let i = 0; i < element.geometry.length - 1; i++) {
              const p1 = element.geometry[i];
              const p2 = element.geometry[i + 1];
              // Simple distance calculation (haversine or just Euclidean for short distances)
              const dLat = (p2.lat - p1.lat) * 111;
              const dLon = (p2.lon - p1.lon) * 111 * Math.cos(p1.lat * Math.PI / 180);
              length += Math.sqrt(dLat * dLat + dLon * dLon);
            }
            if (length > maxBridgeLength) maxBridgeLength = length;
          }
        }
      }

      // 6. Estimate max/min elevation
      let maxElevation = 0;
      let minElevation = 10000;

      // Sample max 20 points for elevation to prevent rate limits
      const step = Math.max(1, Math.floor(routeCoordinates.length / 20));
      const sampleCoords = [];
      for (let i = 0; i < routeCoordinates.length; i += step) {
        sampleCoords.push(routeCoordinates[i]);
      }

      const elevations = await geoServices.getElevationsBatch(sampleCoords);
      for (const elevation of elevations) {
        if (elevation > maxElevation) maxElevation = elevation;
        if (elevation < minElevation) minElevation = elevation;
      }

      // 7. Format the result
      const startAddress = await geoServices.reverseGeocode(Number(start.lat), Number(start.lon));
      const endAddress = await geoServices.reverseGeocode(Number(end.lat), Number(end.lon));

      return {
        routeName: `${this.formatAddress(start.display_name)} ➔ ${this.formatAddress(end.display_name)}`,
        distanceKm: primaryRoute.distance / 1000,
        durationMinutes: Math.round(primaryRoute.duration / 60),
        crossings: validCrossings,
        routeCoordinates: routeCoordinates,
        hasBridge,
        hasTunnel,
        maxElevation,
        minElevation,
        maxBridgeLength,
        startCountry: startAddress.address?.country,
        endCountry: endAddress.address?.country,
        startIsland: startAddress.address?.island,
        endIsland: endAddress.address?.island
      };

    } catch (error) {
      console.error("TripEngine Error:", error);
      throw new Error("Erreur lors de la planification du trajet. Vérifie ta connexion.");
    }
  }

  /**
   * Filters a list of crossings to only include those that fall within 
   * MAX_CROSSING_DISTANCE_METERS of any segment of the route polyline.
   */
  private static filterCrossingsOnRoute(
    crossings: OverpassElement[], 
    routeCoords: [number, number][]
  ): OverpassElement[] {
    if (routeCoords.length < 2) return [];

    return crossings.filter(crossing => {
      // Check distance against every segment of the route
      for (let i = 0; i < routeCoords.length - 1; i++) {
        const [lonA, latA] = routeCoords[i];
        const [lonB, latB] = routeCoords[i + 1];

        const distance = pointToSegmentDistance(
          crossing.lat, crossing.lon,
          latA, lonA,
          latB, lonB
        );

        if (distance <= this.MAX_CROSSING_DISTANCE_METERS) {
          return true; // Keep this crossing
        }
      }
      return false; // Discard, too far from route
    });
  }

  /**
   * Cleans up Nominatim display names to be more readable.
   * Takes the first two parts of the address (e.g., "123 Rue Principale, Montréal")
   */
  private static formatAddress(displayName: string): string {
    const parts = displayName.split(',');
    if (parts.length >= 2) {
      return `${parts[0].trim()}, ${parts[1].trim()}`;
    }
    return displayName;
  }
}
