---
Task ID: 1
Agent: Main Agent
Task: Fix map background, tooltip, Segurança inside Serviços, and click propagation issues

Work Log:
- Read and analyzed current state of page.tsx and brazil-map.tsx
- Fixed map background: removed `bg-gray-900` from main container that was covering the map-bg.png background image
- Added mouse-following tooltip to brazil-map.tsx: added mousePos state, containerRef, onMouseMove handler on the SVG container, and positioned tooltip near cursor
- Removed separate "Segurança" button from state content area, keeping only "Serviços" button
- Made Serviços button larger and more tappable with bg-white/5 backdrop-blur and border styling
- Added e.stopPropagation() to Serviços button onClick to prevent event bubbling to parent div
- Verified all changes with Agent Browser - all 9 steps passed

Stage Summary:
- Map background now shows map-bg.png image instead of solid gray
- Hover tooltips follow mouse cursor when hovering over states
- Only one "Serviços" button exists (no separate "Segurança")
- "Segurança" is accessible inside the Serviços modal as the first item
- Clicking "Serviços" properly opens the modal instead of going back to the map
- All verification steps passed successfully
