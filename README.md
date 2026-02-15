# Tuber — Privacy-First YouTube Frontend

A beautiful, lightweight YouTube search interface built with pure TypeScript. No frameworks, no bloat — just clean, fast, and privacy-focused.

![Tuber Logo](https://img.shields.io/badge/Tuber-Privacy--First-9333ea?style=for-the-badge&logo=youtube&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Pure](https://img.shields.io/badge/Pure-No%20Frameworks-14b8a6?style=for-the-badge)

## ✨ Features

- 🔍 **Smart Search**: Search YouTube videos, channels, and playlists
- 🎨 **Beautiful UI**: Modern design with smooth animations and glassmorphism effects
- 📱 **Responsive**: Works perfectly on desktop, tablet, and mobile
- 🚀 **Lightning Fast**: Pure TypeScript with no framework overhead
- 🔒 **Privacy-Focused**: Direct API calls with no tracking
- 🎯 **Clean Code**: Minimal dependencies, maximum performance

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/tuber.git
cd tuber

# Install dependencies
npm install

# Build the application
npm run build

# Start the server
npm start
```

Visit `http://localhost:3000` and start searching!

## 🏗️ Architecture

```
tuber/
├── src/
│   ├── main.ts          # Main application logic
│   └── server.ts        # HTTP server
├── public/
│   ├── index.html       # HTML entry point
│   ├── styles.css       # Complete styling
│   ├── main.js          # Compiled TypeScript
│   └── favicon.svg      # App icon
├── dist/                # Built files
└── package.json         # Minimal dependencies
```

### Tech Stack
- **Frontend**: Pure TypeScript (no frameworks)
- **Styling**: Custom CSS with modern effects
- **Server**: Node.js HTTP server
- **API**: Direct YouTube Data API integration
- **Build**: TypeScript compiler only

## 🎨 Design Features

- **Gradient Backgrounds**: Animated cosmic gradients
- **Glassmorphism**: Modern frosted glass effects
- **Smooth Animations**: CSS transitions and keyframes
- **Responsive Grid**: Adaptive video result cards
- **Interactive Elements**: Hover effects and micro-animations
- **Loading States**: Beautiful spinners and feedback

## 🔧 Development

### Available Scripts

```bash
npm run build    # Compile TypeScript
npm start        # Start production server
```

### Project Structure

- `src/main.ts`: Core application class with state management
- `src/server.ts`: Static file server
- `public/styles.css`: Complete CSS styling
- `public/index.html`: HTML template with critical CSS

### Adding Features

The app is built with pure TypeScript for maximum simplicity:

```typescript
class TuberApp {
  private state: AppState;

  constructor() {
    this.init();
  }

  private render(): void {
    // Pure DOM manipulation
  }
}
```

## 🔒 Privacy & Security

- **No Tracking**: Direct API calls only
- **No Cookies**: Client-side storage only
- **No Analytics**: Completely private
- **No Frameworks**: Minimal attack surface
- **HTTPS Ready**: Can be deployed with SSL

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🚀 Deployment

### Local Development
```bash
npm install
npm run build
npm start
```

### Production Server
The app serves static files and can be deployed to any web server:

```bash
# Build for production
npm run build

# Serve with any static server
npx serve dist
# or
python -m http.server 3000 -d dist
```

### Docker (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style
- Pure TypeScript (ES2020+)
- Semantic CSS classes
- Minimal dependencies
- Clean, readable code

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ using pure TypeScript
- Inspired by the need for private YouTube browsing
- Thanks to the open-source community

---

**Made with pure TypeScript • No frameworks • Maximum performance**

