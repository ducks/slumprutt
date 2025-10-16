<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import type { GeneratedRoute, Coordinate } from '../types';

  export let routes: GeneratedRoute[] = [];
  export let center: Coordinate = { lat: 40.7128, lon: -74.0060 }; // NYC default

  let mapElement: HTMLDivElement;
  let map: L.Map | null = null;
  let routeLayers: L.Polyline[] = [];
  let markerLayers: L.Marker[] = [];

  const routeColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];

  onMount(() => {
    // Initialize map
    map = L.map(mapElement).setView([center.lat, center.lon], 13);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
  });

  onDestroy(() => {
    if (map) {
      map.remove();
      map = null;
    }
  });

  // Update routes when they change
  $: if (map && routes.length > 0) {
    // Clear existing routes and markers
    routeLayers.forEach(layer => map?.removeLayer(layer));
    markerLayers.forEach(layer => map?.removeLayer(layer));
    routeLayers = [];
    markerLayers = [];

    // Add all routes to map
    routes.forEach((route, idx) => {
      const color = routeColors[idx % routeColors.length];
      const latLngs = route.points.map(p => [p.lat, p.lon] as [number, number]);

      const polyline = L.polyline(latLngs, {
        color,
        weight: 4,
        opacity: 0.7
      }).addTo(map!);

      const distanceKm = route.distance?.toFixed(2) || 'N/A';
      const distanceMi = route.distance ? (route.distance * 0.621371).toFixed(2) : 'N/A';

      polyline.bindPopup(`
        <b>Route ${idx + 1}</b><br/>
        Distance: ${distanceKm} km (${distanceMi} mi)<br/>
        Type: ${route.isLoop ? 'Loop' : 'Point-to-Point'}
      `);

      routeLayers.push(polyline);

      // Add start marker
      if (route.points.length > 0) {
        const start = route.points[0];
        const startMarker = L.marker([start.lat, start.lon], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        }).addTo(map!);
        startMarker.bindPopup('<b>Start</b>');
        markerLayers.push(startMarker);

        // Add end marker if not a loop
        if (!route.isLoop && route.points.length > 1) {
          const end = route.points[route.points.length - 1];
          const endMarker = L.marker([end.lat, end.lon], {
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })
          }).addTo(map!);
          endMarker.bindPopup('<b>End</b>');
          markerLayers.push(endMarker);
        }
      }
    });

    // Fit map to show all routes
    if (routeLayers.length > 0) {
      const group = L.featureGroup(routeLayers);
      map!.fitBounds(group.getBounds().pad(0.1));
    }
  }
</script>

<div class="map-container">
  <div bind:this={mapElement} class="map"></div>
</div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .map {
    width: 100%;
    height: 100%;
  }
</style>
