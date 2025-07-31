# 🏈 College Gridiron Fan

A strategic college football fantasy application where users build weekly lineups with season-long player usage restrictions, compete in leagues, and track real-time performance.

## ✨ Features

### 🎯 Strategic Lineup Management
- **Weekly Team Building**: Select 2 QBs, 2 RBs, and 2 WRs each week using an intuitive drag-and-drop interface
- **Player Usage Limits**: Each player can only be used 3 times per season, adding strategic depth
- **Position Constraints**: Enforced roster requirements ensure balanced team composition

### 🏆 Competitive Experience  
- **Live Scoring**: Real-time point calculations with college football scoring rules
- **League Competition**: Create and join leagues with friends for head-to-head competition
- **Season Tracking**: Historical lineup and performance data across all weeks
- **Leaderboards**: Track rankings and compete for season-long bragging rights

### 📊 Advanced Features
- **Usage Tracking**: Visual indicators show remaining player selections
- **Projected Points**: See estimated scores before finalizing lineups  
- **API Integration**: Connect with college football data sources for up-to-date player information
- **Multi-Week Management**: Navigate between weeks and optimize long-term strategy

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dankatri/college-gridiron-fan.git
   cd college-gridiron-fan
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` to start building your fantasy teams!

### Building for Production
```bash
npm run build
npm run preview
```

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI primitives
- **Build Tool**: Vite
- **Backend**: GitHub Spark framework
- **State Management**: React hooks with persistent storage
- **Animations**: Framer Motion

## 🎮 How to Play

1. **Set Your Lineup**: Navigate to the current week and drag players into your roster slots
2. **Manage Usage**: Keep track of how many times you've used each player (max 3 per season)
3. **Submit Before Kickoff**: Finalize your lineup before games begin
4. **Track Performance**: Watch live scoring as your players perform
5. **Compete**: Join leagues and climb the leaderboards

## 📋 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure
```
src/
├── components/          # React components
├── lib/                # Utilities and types
├── hooks/              # Custom React hooks
└── styles/             # CSS and theme files
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.