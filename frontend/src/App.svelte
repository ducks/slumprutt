<script lang="ts">
  import Map from '$lib/Map.svelte';
  import type { Coordinate, GeneratedRoute, RouteRequest, RouteResponse, TransportMode } from './types';

  let startAddress = '';
  let startCoord: Coordinate | null = null;
  let endAddress = '';
  let endCoord: Coordinate | null = null;
  let mode: TransportMode = 'walk';
  let distanceKm = 5;
  let distanceMiles = 3.1;
  let numRoutes = 3;
  let useEndpoint = false;

  let routes: GeneratedRoute[] = [];
  let loading = false;
  let error = '';

  const API_URL = 'http://localhost:3001';

  // Convert km to miles and vice versa
  function updateKm() {
    distanceKm = Number((distanceMiles * 1.60934).toFixed(2));
  }

  function updateMiles() {
    distanceMiles = Number((distanceKm * 0.621371).toFixed(2));
  }

  // Geocode address using Nominatim (OpenStreetMap)
  async function geocodeAddress(address: string): Promise<Coordinate | null> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      );
      const data = await response.json();

      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon)
        };
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
    return null;
  }

  async function generateRoutes() {
    error = '';
    loading = true;

    try {
      // Geocode start address
      if (!startAddress.trim()) {
        throw new Error('Start address is required');
      }

      startCoord = await geocodeAddress(startAddress);
      if (!startCoord) {
        throw new Error('Could not find start location');
      }

      // Geocode end address if provided
      if (useEndpoint && endAddress.trim()) {
        endCoord = await geocodeAddress(endAddress);
        if (!endCoord) {
          throw new Error('Could not find end location');
        }
      } else {
        endCoord = null;
      }

      // Call backend API
      const request: RouteRequest = {
        start: startCoord,
        end: endCoord || undefined,
        mode,
        numRoutes,
        distanceKm
      };

      const response = await fetch(`${API_URL}/api/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error('Failed to generate routes');
      }

      const data: RouteResponse = await response.json();
      routes = data.routes;

    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      routes = [];
    } finally {
      loading = false;
    }
  }
</script>

<main>
  <div class="container">
    <aside class="sidebar">
      <h1>🗺️ Slumprutt</h1>
      <p class="tagline">Generate random routes for your adventures</p>

      <form on:submit|preventDefault={generateRoutes}>
        <div class="form-group">
          <label for="start">Start Location</label>
          <input
            id="start"
            type="text"
            bind:value={startAddress}
            placeholder="123 Main St, City, State"
            required
          />
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" bind:checked={useEndpoint} />
            Add destination (otherwise creates a loop)
          </label>
        </div>

        {#if useEndpoint}
          <div class="form-group">
            <label for="end">End Location</label>
            <input
              id="end"
              type="text"
              bind:value={endAddress}
              placeholder="456 Oak Ave, City, State"
            />
          </div>
        {/if}

        <div class="form-group">
          <label for="mode">Mode of Transportation</label>
          <select id="mode" bind:value={mode}>
            <option value="walk">Walking</option>
            <option value="bike">Cycling</option>
            <option value="car">Driving</option>
          </select>
        </div>

        <div class="form-group">
          <label for="distance-mi">Target Distance</label>
          <div class="distance-inputs">
            <div>
              <input
                id="distance-mi"
                type="number"
                bind:value={distanceMiles}
                on:input={updateKm}
                min="0.5"
                max="100"
                step="any"
              />
              <span>miles</span>
            </div>
            <div>
              <input
                id="distance-km"
                type="number"
                bind:value={distanceKm}
                on:input={updateMiles}
                min="1"
                max="160"
                step="any"
              />
              <span>km</span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="numRoutes">Number of Routes</label>
          <input
            id="numRoutes"
            type="number"
            bind:value={numRoutes}
            min="1"
            max="5"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Routes'}
        </button>

        {#if error}
          <div class="error">{error}</div>
        {/if}
      </form>

      {#if routes.length > 0}
        <div class="routes-list">
          <h2>Generated Routes</h2>
          {#each routes as route, idx}
            <div class="route-item">
              <h3>Route {idx + 1}</h3>
              <p>
                Distance: {route.distance?.toFixed(2)} km ({(route.distance ? route.distance * 0.621371 : 0).toFixed(2)} mi)
              </p>
              <p>Type: {route.isLoop ? 'Loop' : 'Point-to-Point'}</p>

              {#if route.steps && route.steps.length > 0}
                <details>
                  <summary>Directions ({route.steps.length} steps)</summary>
                  <ol class="directions">
                    {#each route.steps as step, stepIdx}
                      <li>
                        <span class="instruction">{step.instruction}</span>
                        <span class="step-distance">({(step.distance / 1000).toFixed(2)} km)</span>
                      </li>
                    {/each}
                  </ol>
                </details>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </aside>

    <div class="map-wrapper">
      <Map routes={routes} center={startCoord || { lat: 40.7128, lon: -74.0060 }} />
    </div>
  </div>
</main>

<style>
  :global(html),
  :global(body),
  :global(#app) {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }

  main {
    height: 100%;
    overflow: hidden;
  }

  .container {
    display: flex;
    height: 100%;
  }

  .sidebar {
    width: 400px;
    background: #f8f9fa;
    padding: 2rem;
    overflow-y: auto;
    border-right: 1px solid #dee2e6;
  }

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    color: #2c3e50;
  }

  .tagline {
    margin: 0 0 2rem 0;
    color: #6c757d;
    font-size: 0.9rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #495057;
  }

  input[type="text"],
  input[type="number"],
  select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  input[type="checkbox"] {
    margin-right: 0.5rem;
  }

  .distance-inputs {
    display: flex;
    gap: 1rem;
  }

  .distance-inputs > div {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .distance-inputs input {
    width: auto;
    flex: 1;
  }

  .distance-inputs span {
    font-size: 0.9rem;
    color: #6c757d;
  }

  button {
    width: 100%;
    padding: 0.75rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: #0056b3;
  }

  button:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .error {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .routes-list {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #dee2e6;
  }

  .routes-list h2 {
    font-size: 1.2rem;
    margin-bottom: 1rem;
    color: #2c3e50;
  }

  .route-item {
    padding: 1rem;
    background: white;
    border-radius: 4px;
    margin-bottom: 0.75rem;
    border: 1px solid #dee2e6;
  }

  .route-item h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: #495057;
  }

  .route-item p {
    margin: 0.25rem 0;
    font-size: 0.9rem;
    color: #6c757d;
  }

  details {
    margin-top: 0.75rem;
  }

  summary {
    cursor: pointer;
    font-weight: 500;
    color: #007bff;
    font-size: 0.9rem;
    padding: 0.5rem 0;
  }

  summary:hover {
    color: #0056b3;
  }

  .directions {
    margin: 0.5rem 0 0 0;
    padding-left: 1.5rem;
    font-size: 0.85rem;
  }

  .directions li {
    margin-bottom: 0.5rem;
    line-height: 1.4;
    color: #495057;
  }

  .instruction {
    display: block;
  }

  .step-distance {
    color: #6c757d;
    font-size: 0.8rem;
  }

  .map-wrapper {
    flex: 1;
    position: relative;
  }
</style>
