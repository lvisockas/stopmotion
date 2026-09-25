import type { Project } from '../state/project';
import { loadNewsDemo } from './aiNews';
import { familyTripDemo } from './familyTrip';

export interface Demo {
  id: string;
  name: string;
  load: () => Promise<Project | null>;
}

/** The first entry is what a first-time visitor sees. */
export const DEMOS: Demo[] = [
  { id: 'family-trip', name: 'Family trip: Greenland 2026', load: async () => familyTripDemo() },
  { id: 'ai-news', name: 'AI news this week', load: loadNewsDemo },
];
