const titles = [
  'App shells, windows, and layouts', 'Text, forms, and input controls', 'Navigation, notifications, and feedback',
  'Events, branching, and orchestration', 'Variables, collections, and state', 'Data modeling, databases, and search',
  'Filesystem and archives', 'Networking, APIs, and authentication', 'Images, raster editing, and color',
  'Vector graphics, drawing, and geometry', 'Audio creation and processing', 'Video and timeline editing',
  'Three-dimensional assets and scene tooling', 'Documents, office tools, and publishing', 'Charts, dashboards, and reporting',
  'System integration, desktop utilities, and processes', 'AI integrations and intelligent workflows',
  'Automation, scheduling, and background work', 'Code editing, debugging, and developer experience',
  'Build, packaging, publishing, and diagnostics', 'Testing, validation, and benchmarks', 'Security, capabilities, and privacy',
  'Accessibility, localization, and inclusive UX', 'Collaboration, version control, and content management',
  'Specialized advanced adapters', 'Optional experimental building blocks', 'Web research, retrieval, and evidence',
  'Game creation and gameplay', 'Styling', 'Functions', 'Layout', 'Visual Appearance', 'Interface Architecture', 'UI Components', 'Professionalism',
] as const;

export const warehouseCategories = titles.map((title, index) => ({ id: index + 1, title, capacity: 10_000 }));
export const warehouseCapacity = warehouseCategories.reduce((total, category) => total + category.capacity, 0);
