# TruthSpotter Dashboard

A modern fact-checking dashboard built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Fact Verification**: Enter claims to verify their accuracy
- **Evidence Sources**: View multiple sources with credibility scores
- **Verification History**: Track all previous verifications
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Theme**: Toggle between themes
- **Real-time Chat**: Interactive chat interface for claims

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **State Management**: React Hooks
- **Theme**: next-themes

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd truthspotter-dash
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles
├── components/          # React components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── ThemeProvider.tsx # Theme provider
│   └── ui/             # shadcn/ui components
└── lib/                # Utility functions
    └── utils.ts        # Common utilities
```

## Usage

1. **Enter a Claim**: Type any claim or statement in the input field
2. **Get Verification**: Click the search button or press Enter
3. **View Results**: See the verification status, confidence score, and evidence sources
4. **Check History**: Use the sidebar to view previous verifications
5. **Toggle Theme**: Switch between light and dark themes using the theme toggle

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
