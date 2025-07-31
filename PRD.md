# College Football Fantasy Team Picker

A specialized fantasy football application for college football that allows users to draft weekly lineups with season-long player usage restrictions and custom scoring rules.

**Experience Qualities**:
1. Strategic - Users must carefully manage their limited player selections across the season
2. Competitive - Clear scoring display and weekly performance tracking drives engagement  
3. Intuitive - Simple drag-and-drop team building with clear visual feedback

**Complexity Level**: Light Application (multiple features with basic state)
- Manages weekly lineups, player usage tracking, and scoring calculations with persistent data across multiple weeks

## Essential Features

**Weekly Team Selection**
- Functionality: Select 2 QBs, 2 RBs, 2 WRs for each week with drag-and-drop interface
- Purpose: Core fantasy experience with position-based constraints
- Trigger: User navigates to current week's lineup page
- Progression: View available players → drag to roster slots → confirm lineup → see scoring projections
- Success criteria: Lineup saves with exactly 6 players in correct positions

**Player Usage Tracking**
- Functionality: Track how many times each player has been selected (max 3 per season)
- Purpose: Adds strategic depth and prevents over-reliance on top players
- Trigger: Player selection in weekly lineup
- Progression: Select player → usage counter increments → visual indicator shows remaining uses → player becomes unavailable at 3 uses
- Success criteria: Players lock out after 3 selections, usage persists across weeks

**Scoring System**
- Functionality: Calculate points using custom college football scoring rules
- Purpose: Differentiate from NFL fantasy with college-appropriate scoring
- Trigger: Real-time as lineup is built, final calculation after games
- Progression: Select players → see projected points → submit lineup → view actual results → see total score
- Success criteria: Accurate point calculations matching the specified scoring system

**Season Management**
- Functionality: Navigate between weeks, view historical lineups and scores
- Purpose: Track season-long performance and strategic decisions
- Trigger: Week navigation or season overview access
- Progression: Select week → view/edit lineup → see results → compare with other weeks
- Success criteria: All weeks accessible with saved lineups and scores

## Edge Case Handling

- **Incomplete Lineup**: Prevent submission until all 6 roster spots filled
- **Player Unavailable**: Show clear messaging when player has reached usage limit
- **Mid-Season Entry**: New users can start any week with fresh player usage counts
- **Data Loss**: Persist all selections and usage data between sessions

## Design Direction

The design should feel competitive and analytical like ESPN fantasy sports, with clean data tables and clear visual hierarchy that emphasizes strategic decision-making over flashy graphics.

## Color Selection

Triadic color scheme using college football inspired colors that convey tradition and competition.

- **Primary Color**: Deep College Blue (oklch(0.35 0.15 250)) - Communicates trust and tradition
- **Secondary Colors**: Forest Green (oklch(0.45 0.12 140)) for positive actions, Warm Gray (oklch(0.65 0.02 80)) for neutral elements  
- **Accent Color**: Victory Gold (oklch(0.75 0.18 65)) - Attention-grabbing highlight for scores and achievements
- **Foreground/Background Pairings**: 
  - Background (White oklch(1 0 0)): Dark Text (oklch(0.15 0 0)) - Ratio 16.8:1 ✓
  - Card (Light Gray oklch(0.98 0.01 80)): Dark Text (oklch(0.15 0 0)) - Ratio 15.2:1 ✓
  - Primary (Deep Blue oklch(0.35 0.15 250)): White Text (oklch(1 0 0)) - Ratio 8.2:1 ✓
  - Accent (Victory Gold oklch(0.75 0.18 65)): Dark Text (oklch(0.15 0 0)) - Ratio 11.5:1 ✓

## Font Selection

Typography should convey authority and clarity like sports broadcasts, using a clean sans-serif that handles data tables and statistics effectively.

- **Typographic Hierarchy**: 
  - H1 (Page Title): Inter Bold/32px/tight letter spacing
  - H2 (Section Headers): Inter Semibold/24px/normal spacing  
  - H3 (Player Names): Inter Medium/18px/normal spacing
  - Body (Stats/Scores): Inter Regular/16px/relaxed spacing
  - Caption (Usage Counter): Inter Medium/14px/tight spacing

## Animations

Subtle functionality-focused animations that provide immediate feedback for drag-and-drop actions and state changes without distracting from strategic decision-making.

- **Purposeful Meaning**: Smooth drag animations communicate successful player selection, score counter animations highlight point changes
- **Hierarchy of Movement**: Player card selections deserve primary animation focus, secondary animations for usage warnings and lineup validation

## Component Selection

- **Components**: Card for player displays, Table for statistics, Tabs for week navigation, Badge for usage counters, Dialog for lineup confirmation, Button for primary actions
- **Customizations**: Drag-and-drop player cards with hover states, usage progress indicators, score calculation displays
- **States**: Player cards show available/limited/exhausted states, buttons disable when lineup incomplete, drag zones highlight on hover
- **Icon Selection**: Trophy for scores, Users for roster management, Calendar for week selection, Target for position requirements
- **Spacing**: Consistent 4-unit grid spacing (16px) between cards, 2-unit (8px) internal card padding
- **Mobile**: Stack player selection and roster vertically, condensed table views, sticky week navigation tabs