# chessremastered
chess remastered
Chess V4 Remastered:
1. Game Modes & logic
Versus AI: A single-player mode against a custom-built chess engine. It includes 3 difficulty levels (Easy, Medium, Hard) that adjust the depth of the Minimax algorithm.
2 Player (Hotseat): A local multiplayer mode where two humans can play on the same device. The UI updates to show whose turn it is (White/Black) dynamically.
Full Rules Implementation:
Move Validation: Prevents illegal moves and enforces movement rules for all pieces.
Special Moves: Supports Castling (Kingside & Queenside) and Pawn Promotion (opens a modal to select Queen, Rook, Bishop, or Knight).
Win Conditions: Detects Checkmate, Stalemate (Draw), and "Time Up".
2. Advanced Chess Engine
Minimax Algorithm: The AI uses a minimax algorithm with Alpha-Beta Pruning to calculate moves efficiently.
King Safety: Includes a ray-casting attack detection system to strictly prevent the King from moving into check.
Notation (SAN): It generates standard chess notation (e.g., Nf3, O-O, Qxd5+) for every move and displays it in a scrollable history log.
3. User Interface (UI) & UX
Interactive Board:
Visual Hints: Highlights valid move targets (dots for empty squares, rings for captures).
Feedback: Highlights the selected piece, the last move made, and pieces in check.
Animations: Smooth "Pop-in" animations for moves and a specific "Fade-out/Scale-up" animation when pieces are captured.
Heads Up Display (HUD): Shows player timers (10 minutes default), current status, and a list of captured pieces sorted by value.
Controls:
Undo Move: Allows stepping back (handles 1 step for PvP and 2 steps for PvAI).
Flip Board: Visually rotates the board for the black player.
Save/Load: Uses localStorage to persist the game state, allowing players to close the browser and resume later.
4. Truly Independent Architecture ("Hardcoded")
Procedural Audio: It uses the Web Audio API to generate sound effects (move taps, capture thuds, victory fanfares) mathematically in real-time. It does not load external MP3 files.
Embedded Assets: All icons (favicons, app icons) are Base64 SVG Data URIs embedded directly in the HTML/Manifest. It does not fetch external images.
System Fonts: Uses native system fonts (Segoe UI Symbol, Apple Symbols) to render the chess pieces using Unicode characters, removing the need for font downloads.
5. Mobile & PWA Features
Offline Capable: A Service Worker (sw.js) caches the React and Tailwind libraries, allowing the game to run completely offline after the first load.
Installable: Includes a manifest.json so it can be installed on a phone home screen as a standalone app.
Responsive: Handles safe-area insets (notches/home bars) on mobile devices (viewport-fit=cover) and uses dynamic sizing to fit any screen.
