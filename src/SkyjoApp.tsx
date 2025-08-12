import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Shuffle, Eye, Play, RotateCcw, Users, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * SKYJO — iPhone 15 one-file prototype (no assets required)
 * Notes:
 * - Uses a placeholder "SKYJO" text mark and original-but-generic card visuals (not the official artwork).
 * - Swap `Logo` and `renderCardFace` to plug in licensed assets later.
 * - Implements: Start screen → deal 12 cards per player → each player reveals two → player with HIGHEST sum starts (as requested) → minimal classic turn loop (draw, take discard, swap or discard+flip).
 * - Screen sized to iPhone 15 logical viewport (approx 393×852) with a locked aspect container.
 */

// ---- Game constants (approximating the real Skyjo deck distribution) ----
const CARD_DISTRIBUTION: Record<number, number> = {
  [-2]: 5,
  [-1]: 10,
  [0]: 15,
  [1]: 10,
  [2]: 10,
  [3]: 10,
  [4]: 10,
  [5]: 10,
  [6]: 10,
  [7]: 8,
  [8]: 8,
  [9]: 8,
  [10]: 8,
  [11]: 8,
  [12]: 8,
};

// ---- Types ----
interface CardT {
  id: string;
  value: number;
  faceUp: boolean;
}

interface PlayerT {
  id: number;
  name: string;
  cards: CardT[]; // 12 cards in 3x4 grid
}

// ---- Utilities ----
const uid = (() => {
  let n = 0;
  return () => `${Date.now().toString(36)}_${n++}`;
})();

function buildDeck(): CardT[] {
  const deck: CardT[] = [];
  Object.entries(CARD_DISTRIBUTION).forEach(([s, count]) => {
    const value = Number(s);
    for (let i = 0; i < (count as number); i++) {
      deck.push({ id: uid(), value, faceUp: false });
    }
  });
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sum(arr: number[]) {
  return arr.reduce((acc, n) => acc + n, 0);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---- Visual helpers (placeholder logo + card styling) ----
function Logo() {
  return (
    <div className="flex items-center justify-center select-none">
      <motion.div
        initial={{ scale: 0.9, rotate: -2, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="text-5xl font-extrabold tracking-widest"
        style={{
          textShadow: "0 2px 0 rgba(0,0,0,0.08)",
        }}
      >
        <span className="px-3 py-1 rounded-xl border border-zinc-200 shadow-sm bg-white">SKYJO</span>
      </motion.div>
    </div>
  );
}

function cardColor(value: number): string {
  if (value < 0) return "bg-teal-200";
  if (value <= 3) return "bg-emerald-200";
  if (value <= 6) return "bg-lime-200";
  if (value <= 9) return "bg-yellow-200";
  if (value <= 12) return "bg-orange-200";
  return "bg-slate-200";
}

function renderCardFace(value: number) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-2xl font-bold select-none">{value}</div>
    </div>
  );
}

// ---- Main Component ----
export default function SkyjoPrototype() {
  const [phase, setPhase] = useState<"start" | "reveal" | "play">("start");
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [players, setPlayers] = useState<PlayerT[]>([]);
  const [deck, setDeck] = useState<CardT[]>([]);
  const [discard, setDiscard] = useState<CardT[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<number>(0);
  const [revealTargets, setRevealTargets] = useState<Record<number, number>>( {} ); // playerId → how many revealed so far in init
  const [drawnCard, setDrawnCard] = useState<CardT | null>(null);
  const [message, setMessage] = useState<string>("");

  // iPhone 15 aspect container (approx 393×852)
  const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="w-full flex justify-center py-4">
      <div className="relative w-[393px] aspect-[393/852] rounded-[2rem] border bg-gradient-to-b from-zinc-50 to-white shadow-xl overflow-hidden">
        {children}
      </div>
    </div>
  );

  function startGame() {
    const d = buildDeck();
    // deal 12 per player
    const ps: PlayerT[] = Array.from({ length: playerCount }).map((_, i) => ({
      id: i,
      name: `Spieler ${i + 1}`,
      cards: Array.from({ length: 12 }).map(() => {
        const c = d.pop()!;
        return { ...c, faceUp: false };
      }),
    }));
    // flip one to discard to start the pile
    const firstDiscard = d.pop()!;
    setDiscard([{ ...firstDiscard, faceUp: true }]);
    setPlayers(ps);
    setDeck(d);
    setPhase("reveal");
    setMessage("Jeder Spieler deckt 2 Karten auf. Höchste Summe beginnt.");
    const init: Record<number, number> = {};
    ps.forEach((p) => (init[p.id] = 0));
    setRevealTargets(init);
    setCurrentPlayer(0);
  }

  function resetGame() {
    setPhase("start");
    setPlayers([]);
    setDeck([]);
    setDiscard([]);
    setCurrentPlayer(0);
    setRevealTargets({});
    setDrawnCard(null);
    setMessage("");
  }

  // Initial reveal logic
  function handleInitFlip(pIndex: number, cIndex: number) {
    if (phase !== "reveal") return;
    if (pIndex !== currentPlayer) return; // only active player
    const revealed = revealTargets[players[pIndex].id] || 0;
    if (revealed >= 2) return;

    setPlayers((prev) => {
      const cp = [...prev];
      const pc = { ...cp[pIndex] };
      const cards = [...pc.cards];
      if (cards[cIndex]?.faceUp) return prev; // already up
      cards[cIndex] = { ...cards[cIndex], faceUp: true };
      pc.cards = cards;
      cp[pIndex] = pc;
      return cp;
    });

    const nextCount = revealed + 1;
    const nextMap = { ...revealTargets, [players[pIndex].id]: nextCount };
    setRevealTargets(nextMap);

    if (nextCount === 2) {
      // move to next player or finish init
      const nextPlayer = currentPlayer + 1;
      if (nextPlayer < players.length) {
        setCurrentPlayer(nextPlayer);
        setMessage(`${players[nextPlayer].name} ist dran: zwei Karten aufdecken.`);
      } else {
        // everyone revealed two → decide starter (HIGHEST sum as per prompt)
        const sums = players.map((p) => sum(p.cards.filter((c) => c.faceUp).map((c) => c.value)));
        const max = Math.max(...sums);
        const startIndex = sums.indexOf(max);
        setCurrentPlayer(startIndex);
        setPhase("play");
        setMessage(`${players[startIndex].name} beginnt (höchste Summe ${max}).`);
      }
    }
  }

  // ---- Play phase actions ----
  function drawFromDeck() {
    if (phase !== "play" || drawnCard) return;
    const d = [...deck];
    if (!d.length) return;
    const c = d.pop()!;
    c.faceUp = true; // show the drawn card to the player
    setDeck(d);
    setDrawnCard(c);
    setMessage(`${players[currentPlayer].name} hat ${c.value} gezogen.`);
  }

  function takeFromDiscard() {
    if (phase !== "play" || drawnCard) return;
    const p = [...discard];
    if (!p.length) return;
    const c = p.pop()!;
    setDiscard(p);
    setDrawnCard({ ...c });
    setMessage(`${players[currentPlayer].name} nimmt Ablagestapel (${c.value}).`);
  }

  function placeDrawnAt(index: number) {
    if (!drawnCard) return;
    setPlayers((prev) => {
      const cp = [...prev];
      const pl = { ...cp[currentPlayer] };
      const cards = [...pl.cards];
      const replaced = cards[index];
      const newCard = { ...drawnCard, faceUp: true };
      cards[index] = newCard;
      pl.cards = cards;
      cp[currentPlayer] = pl;
      // replaced card goes to discard (face up)
      setDiscard((old) => [...old, { ...replaced, faceUp: true }]);
      return cp;
    });
    endTurn();
  }

  function discardDrawnAndFlip(indexToFlip?: number) {
    if (!drawnCard) return;
    setDiscard((old) => [...old, { ...drawnCard, faceUp: true }]);
    setDrawnCard(null);

    if (indexToFlip != null) {
      setPlayers((prev) => {
        const cp = [...prev];
        const pl = { ...cp[currentPlayer] };
        const cards = [...pl.cards];
        if (!cards[indexToFlip].faceUp) {
          cards[indexToFlip] = { ...cards[indexToFlip], faceUp: true };
        }
        pl.cards = cards;
        cp[currentPlayer] = pl;
        return cp;
      });
    }
    endTurn();
  }

  function endTurn() {
    setDrawnCard(null);
    const next = (currentPlayer + 1) % players.length;
    setCurrentPlayer(next);
    setMessage(`${players[next].name} ist am Zug.`);
  }

  // ---- UI bits ----
  function PlayerGrid({ p, index, dim }: { p: PlayerT; index: number; dim?: boolean }) {
    const rows = chunk(p.cards, 4);
    const isActive = phase === "reveal" ? index === currentPlayer : phase === "play" ? index === currentPlayer : false;
    return (
      <div className={`rounded-2xl p-3 ${isActive ? "ring-2 ring-blue-500" : "ring-1 ring-zinc-200"} ${dim ? "opacity-60" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">{p.name}</div>
          <div className="text-sm text-zinc-500">Summe sichtbar: {sum(p.cards.filter((c) => c.faceUp).map((c) => c.value))}</div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {rows.flatMap((row, r) =>
            row.map((card, cIdx) => (
              <motion.div
                key={card.id}
                layout
                whileHover={{ scale: isActive ? 1.03 : 1.0 }}
                className={`relative aspect-[2/3] rounded-xl shadow-sm border overflow-hidden cursor-pointer select-none ${card.faceUp ? cardColor(card.value) : "bg-white"}`}
                onClick={() =>
                  phase === "reveal"
                    ? handleInitFlip(index, r * 4 + cIdx)
                    : drawnCard
                    ? placeDrawnAt(r * 4 + cIdx)
                    : undefined
                }
              >
                {/* back pattern */}
                {!card.faceUp && (
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200" />
                )}
                {/* face */}
                {card.faceUp && renderCardFace(card.value)}
              </motion.div>
            ))
          )}
        </div>
        {phase === "play" && index === currentPlayer && !drawnCard && (
          <div className="text-xs text-zinc-500 mt-2">Ziehen oder Ablage nehmen, dann Karte ersetzen ODER ablegen und eine verdeckte Karte aufdecken.</div>
        )}
        {phase === "play" && index === currentPlayer && drawnCard && (
          <div className="text-xs text-zinc-500 mt-2">Klicke eine deiner Karten, um sie zu ersetzen, oder lege die gezogene Karte ab und decke eine verdeckte Karte auf.</div>
        )}
      </div>
    );
  }

  function StartScreen() {
    return (
      <div className="h-full w-full flex flex-col">
        <div className="p-6">
          <Logo />
        </div>
        <div className="px-6 mt-4">
          <UICard className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2 text-zinc-600"><Users className="h-4 w-4" /> Anzahl der Spieler</div>
              <Select value={String(playerCount)} onValueChange={(v) => setPlayerCount(Number(v))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Spieler wählen" />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-3 mt-4">
                <Button className="rounded-2xl" onClick={startGame}>
                  <Play className="mr-2 h-4 w-4" /> Spiel starten
                </Button>
                <Button variant="secondary" className="rounded-2xl" onClick={resetGame}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Zurücksetzen
                </Button>
              </div>
            </CardContent>
          </UICard>
          <div className="mt-6 text-xs text-zinc-500">
            Hinweis: Diese Demo nutzt generische Karten-Visuals (keine Original-Assets). Eigene Grafiken können später eingebunden werden.
          </div>
        </div>
      </div>
    );
  }

  function TopBar() {
    return (
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white/70 backdrop-blur sticky top-0 z-10">
        <button onClick={resetGame} className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900">
          <ChevronLeft className="h-4 w-4" /> Menü
        </button>
        <Logo />
        <div className="text-xs text-zinc-500 w-[88px] text-right">iPhone 15</div>
      </div>
    );
  }

  function TableArea() {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {players.map((p, i) => (
            <PlayerGrid key={p.id} p={p} index={i} dim={phase!=="reveal" && phase!=="play"} />
          ))}
        </div>
      </div>
    );
  }

  function BottomBar() {
    const topDiscard = discard[discard.length - 1];
    return (
      <div className="border-t bg-white/70 backdrop-blur sticky bottom-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="text-sm flex-1 text-zinc-700 truncate">{message || (phase === "play" ? `${players[currentPlayer]?.name} ist am Zug.` : "")}</div>
          {phase === "play" && (
            <div className="flex items-center gap-3">
              {!drawnCard ? (
                <>
                  <Button variant="secondary" className="rounded-xl" onClick={takeFromDiscard}>
                    Ablage nehmen {topDiscard ? `(${topDiscard.value})` : ""}
                  </Button>
                  <Button className="rounded-xl" onClick={drawFromDeck}>
                    Ziehen <Shuffle className="ml-2 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" className="rounded-xl" onClick={() => discardDrawnAndFlip(findFirstFaceDownIndex(players[currentPlayer].cards))}>
                    Ablegen & erste verdeckte aufdecken
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  function findFirstFaceDownIndex(cards: CardT[]) {
    const idx = cards.findIndex((c) => !c.faceUp);
    return idx >= 0 ? idx : undefined;
  }

  return (
    <Frame>
      <div className="absolute inset-0 flex flex-col">
        {phase === "start" && <StartScreen />}
        {(phase === "reveal" || phase === "play") && (
          <>
            <TopBar />
            <TableArea />
            <BottomBar />
          </>
        )}
      </div>
    </Frame>
  );
}
