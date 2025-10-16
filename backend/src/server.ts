import express from 'express';
import cors from 'cors';
import type { RouteRequest, RouteResponse } from './types.js';
import { generateRoutes, getRoutedPaths } from './routeGenerator.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/route', async (req, res) => {
  try {
    const { start, end, mode = 'walk', numRoutes = 3, distanceKm = 5 }: RouteRequest = req.body;

    if (!start?.lat || !start?.lon) {
      return res.status(400).json({ error: 'Start location with lat/lon required' });
    }

    // Generate random waypoints
    const routes = generateRoutes(start, end, numRoutes, distanceKm);

    // Get actual routed paths from OSRM
    const routedRoutes = await getRoutedPaths(routes, mode);

    const response: RouteResponse = {
      routes: routedRoutes,
      mode,
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating routes:', error);
    res.status(500).json({ error: 'Failed to generate routes' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'slumprutt-backend' });
});

app.listen(PORT, () => {
  console.log(`🗺️  Slumprutt backend running on http://localhost:${PORT}`);
});
