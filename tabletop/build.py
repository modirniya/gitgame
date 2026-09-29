#!/usr/bin/env python3
"""Build the print-and-play PDF from rules/deck.json.

Why this exists: the deck is data (rules/deck.json) so that a playtest tweak is a
one-line change. This script is the only thing that knows how a card looks on paper.

Usage:  python3 tabletop/build.py            # writes tabletop/print-and-play.pdf
Needs:  reportlab  (pip install reportlab)

Layout: US Letter, poker-size cards (2.5 x 3.5 in), 9 per page, cut lines between
cards. Single-sided: faces only. See tabletop/README.md for how to hide the faces.
"""
import json
import sys
from pathlib import Path

try:
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib.utils import simpleSplit
    from reportlab.pdfgen import canvas
except ImportError:
    sys.exit("reportlab is missing: pip install reportlab")

ROOT = Path(__file__).resolve().parent.parent
DECK = json.loads((ROOT / "rules" / "deck.json").read_text())
OUT = ROOT / "tabletop" / "print-and-play.pdf"
BRAND = DECK["brand"]["name"]

PAGE_W, PAGE_H = letter
CARD_W, CARD_H = 2.5 * inch, 3.5 * inch
COLS, ROWS = 3, 3
GRID_W, GRID_H = COLS * CARD_W, ROWS * CARD_H
X0, Y0 = (PAGE_W - GRID_W) / 2, (PAGE_H - GRID_H) / 2

INK = HexColor("#1B2228")
MUTED = HexColor("#6B7A86")
RULE = HexColor("#C9D1D8")
BUG = HexColor("#D9432F")
CMD = HexColor("#2F3A44")
INCIDENT = HexColor("#E9A83B")
TICKET = HexColor("#5C6BC0")
ROLE = HexColor("#5CB48C")


# ---------- primitives ----------

def wrap(c, text, x, y, w, size, leading=None, font="Helvetica", color=INK, max_lines=None):
    """Draw wrapped text from the top-left (x, y). Returns the y below the last line."""
    leading = leading or size * 1.3
    c.setFont(font, size)
    c.setFillColor(color)
    lines = simpleSplit(text, font, size, w)
    if max_lines:
        lines = lines[:max_lines]
    for line in lines:
        y -= leading
        c.drawString(x, y, line)
    return y


def cut_marks(c):
    c.setStrokeColor(RULE)
    c.setLineWidth(0.3)
    for i in range(COLS + 1):
        x = X0 + i * CARD_W
        c.line(x, Y0 - 12, x, Y0 + GRID_H + 12)
    for j in range(ROWS + 1):
        y = Y0 + j * CARD_H
        c.line(X0 - 12, y, X0 + GRID_W + 12, y)


def card_frame(c, x, y, band_color, kind):
    """Common chrome: a colored band at the top and the card kind in small caps."""
    c.setFillColor(band_color)
    c.rect(x, y + CARD_H - 0.32 * inch, CARD_W, 0.32 * inch, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(x + 9, y + CARD_H - 0.2 * inch, kind.upper())
    c.setFont("Helvetica", 6)
    c.drawRightString(x + CARD_W - 9, y + CARD_H - 0.2 * inch, BRAND)


# ---------- card faces ----------

def commit_face(c, x, y, file, lines, bug):
    color = HexColor(next(f["color"] for f in DECK["files"] if f["name"] == file))
    card_frame(c, x, y, color, "commit")
    c.setFillColor(INK)
    c.setFont("Courier-Bold", 17)
    c.drawCentredString(x + CARD_W / 2, y + CARD_H - 0.95 * inch, file)
    c.setFont("Helvetica-Bold", 44)
    c.drawCentredString(x + CARD_W / 2, y + CARD_H - 1.85 * inch, f"+{lines}")
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawCentredString(x + CARD_W / 2, y + CARD_H - 2.1 * inch, "lines")
    if bug:
        c.setFillColor(BUG)
        c.roundRect(x + 0.5 * inch, y + 0.42 * inch, CARD_W - 1.0 * inch, 0.38 * inch, 5, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(x + CARD_W / 2, y + 0.53 * inch, "BUG")
        wrap(c, "Only you can see this. Push it anyway?", x + 0.25 * inch, y + 0.38 * inch, CARD_W - 0.5 * inch, 6.5, color=MUTED)


def text_face(c, x, y, band, kind, title, body, footer=None, title_font="Helvetica-Bold", title_size=13):
    card_frame(c, x, y, band, kind)
    top = y + CARD_H - 0.5 * inch
    bottom = wrap(c, title, x + 0.2 * inch, top, CARD_W - 0.4 * inch, title_size, font=title_font)
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line(x + 0.2 * inch, bottom - 6, x + CARD_W - 0.2 * inch, bottom - 6)
    wrap(c, body, x + 0.2 * inch, bottom - 10, CARD_W - 0.4 * inch, 8.2, leading=10.5)
    if footer:
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(MUTED)
        c.drawString(x + 0.2 * inch, y + 0.22 * inch, footer)


def command_face(c, x, y, card):
    cost = "free" if card["cost"] == 0 else f"{card['cost']} op"
    text_face(c, x, y, CMD, "command", card["name"], card["text"], footer=f"cost: {cost}", title_font="Courier-Bold", title_size=14)


def incident_face(c, x, y, card):
    text_face(c, x, y, INCIDENT, "incident", card["name"], card["text"], footer="flip one at the start of each round")


def ticket_face(c, x, y, card):
    text_face(c, x, y, TICKET, "secret ticket", card["name"], card["text"], footer=f"+{DECK['tickets']['bonus']} at release · keep hidden")


def role_face(c, x, y, card):
    text_face(c, x, y, ROLE, "role (optional)", card["name"], card["text"], footer="deal one per player, or skip roles")


def initial_face(c, x, y):
    card_frame(c, x, y, MUTED, "main")
    c.setFillColor(INK)
    c.setFont("Courier-Bold", 14)
    c.drawCentredString(x + CARD_W / 2, y + CARD_H / 2 + 8, "initial commit")
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawCentredString(x + CARD_W / 2, y + CARD_H / 2 - 10, "start of main · everyone's pointer begins here")


# ---------- deck expansion ----------

def build_cards():
    """Return a list of (kind, draw_fn) in print order."""
    cards = []
    cc = DECK["commit_cards"]
    for f in DECK["files"]:
        seen_bug_sizes = set()
        for n in cc["lines_per_file"]:
            bug = n in cc["bugs"]["every_file"] and n not in seen_bug_sizes
            bug = bug or any(e["file"] == f["name"] and e["lines"] == n for e in cc["bugs"]["extra"])
            if bug:
                seen_bug_sizes.add(n)
            cards.append(("commit", (lambda c, x, y, f=f["name"], n=n, b=bug: commit_face(c, x, y, f, n, b))))
    for card in DECK["command_cards"]:
        for _ in range(card["count"]):
            cards.append(("command", (lambda c, x, y, card=card: command_face(c, x, y, card))))
    for card in DECK["incidents"]:
        cards.append(("incident", (lambda c, x, y, card=card: incident_face(c, x, y, card))))
    for card in DECK["tickets"]["cards"]:
        cards.append(("ticket", (lambda c, x, y, card=card: ticket_face(c, x, y, card))))
    for card in DECK["roles"]:
        cards.append(("role", (lambda c, x, y, card=card: role_face(c, x, y, card))))
    cards.append(("main", initial_face))
    return cards


# ---------- non-card pages ----------

def cover_page(c, counts, pages):
    s = DECK["setup"]
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 30)
    c.drawString(0.9 * inch, PAGE_H - 1.2 * inch, BRAND)
    c.setFont("Helvetica", 12)
    c.setFillColor(MUTED)
    c.drawString(0.9 * inch, PAGE_H - 1.5 * inch, f"Print-and-play, deck v{DECK['version']} · for playtesting · the name is not final")
    y = PAGE_H - 2.2 * inch
    y = wrap(c, "What's in this file", 0.9 * inch, y, 6.5 * inch, 14, font="Helvetica-Bold")
    lines = [
        f"{counts['commit']} commit cards and {counts['command']} command cards — shuffle these together into one draw deck.",
        f"{counts['incident']} incident cards — a separate face-down pile.",
        f"{counts['ticket']} secret tickets — deal one to each player, face down.",
        f"{counts['role']} optional role cards — deal one each, or leave them out for your first game.",
        "1 initial-commit card, a reference sheet, and a token sheet.",
        f"{pages} card pages at 9 cards per page. Print single-sided on thick paper, or sleeve the cards with opaque backs: face-down cards must not be readable through the paper.",
    ]
    for line in lines:
        y = wrap(c, "•  " + line, 1.1 * inch, y - 4, 6.2 * inch, 10.5)
    y = wrap(c, "Setup", 0.9 * inch, y - 16, 6.5 * inch, 14, font="Helvetica-Bold")
    lines = [
        "Put the initial-commit card in the middle of the table. This is the start of main.",
        "Give each player a pointer token and place it on the initial commit. Everyone starts up to date.",
        f"Shuffle commit and command cards together. Deal {s['starting_hand']} cards to each player.",
        "Deal one secret ticket to each player. Shuffle the incident pile.",
        f"Release: the game ends when main has this many commits — 2 players: {s['release_at_commits']['2']}, 3: {s['release_at_commits']['3']}, 4–5: {s['release_at_commits']['4']} — or when someone plays git tag v1.0 at that point.",
        "Keep merge, grudge and sin tokens in the middle. Cut them from the token sheet or use coins.",
    ]
    for line in lines:
        y = wrap(c, "•  " + line, 1.1 * inch, y - 4, 6.2 * inch, 10.5)
    y = wrap(c, "Playtesting", 0.9 * inch, y - 16, 6.5 * inch, 14, font="Helvetica-Bold")
    wrap(c, "The rules live in docs/design/base-rules.md and this deck in rules/deck.json. After a game, write down: what was tense, what was boring, "
            "where the rules were unclear, and who won and why. That report is the most valuable thing this deck can produce.",
         1.1 * inch, y - 4, 6.2 * inch, 10.5)
    c.showPage()


def reference_page(c):
    s = DECK["setup"]
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(0.9 * inch, PAGE_H - 0.9 * inch, "Turn reference")
    col_w = 3.2 * inch
    left, right = 0.9 * inch, 4.4 * inch
    y = PAGE_H - 1.3 * inch

    def section(x, y, title, items):
        y = wrap(c, title, x, y, col_w, 11.5, font="Helvetica-Bold")
        for it in items:
            y = wrap(c, it, x, y - 2, col_w, 9, leading=11.5)
        return y - 8

    y1 = section(left, y, "Your turn", [
        f"1. Draw {s['draw_per_turn']} cards (new tickets came in).",
        f"2. Spend {s['ops_per_turn']} ops, in any order.",
        "3. Say a real commit message out loud when you commit. \"fix\", \"wip\" or \"asdf\" draws a bug.",
    ])
    y1 = section(left, y1, "Ops", [
        "git add (1) — move any number of hand cards to your staging area, face down.",
        "git commit (1) — all staged cards become ONE commit on your local branch.",
        "git push (1) — move your local commits onto the end of main. Rejected if your pointer is not at the tip. The op is still spent.",
        "git pull (1) — move your pointer to the tip. Take a merge token (-1 at release).",
        "git pull --rebase (2) — same, no merge token.",
        "play a command card (its printed cost).",
    ])
    section(left, y1, "Merge conflicts", [
        "When you pull, if any of your unpushed commits touches the same file as a commit you're pulling in, you have a conflict. Choose:",
        "ours — keep yours; their commit is flipped and crossed out, its author loses those lines and gives you a grudge token (-1 at release).",
        "theirs — discard your commit.",
        "resolve (+1 op) — keep both.",
    ])
    y2 = section(right, y, "The commit-size gamble", [
        "One big commit scores its lines all at once but costs one op. If one card inside is a bug and it is blamed, the whole commit takes the penalty. Small commits are safe and slow.",
    ])
    y2 = section(right, y2, "Bugs and blame", [
        "About one card in five is a bug. It is printed on the face; only the holder knows. You may push it.",
        "git blame flips a commit. A bug costs its author -3 on the spot. A bug hidden in a squashed commit costs -5.",
        "revert neutralises a face-up bug: it no longer counts at release. +1 for the fixer.",
    ])
    y2 = section(right, y2, "Release (CI)", [
        f"When main reaches the target size, anyone may play git tag v1.0 (1 op). Flip every commit on main. Each bug: -3 to its author.",
        f"If {s['production_down_at_bugs']} or more bugs reached production, the release fails: the player with the LEAST blame wins.",
        "Otherwise: lines shipped - blame - merge tokens - grudges - sins + secret ticket.",
    ])
    section(right, y2, "Incidents", [
        "Flip one incident at the start of every round (before the first player's turn). It applies to everyone this round.",
    ])
    c.showPage()


def token_page(c):
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(0.9 * inch, PAGE_H - 0.9 * inch, "Tokens")
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    c.drawString(0.9 * inch, PAGE_H - 1.15 * inch, "Cut along the lines, or use coins, paper clips and dice instead. Pointer tokens go on main; one color per player.")
    size = 0.6 * inch
    y = PAGE_H - 1.6 * inch
    for name, spec in ((k, v) for k, v in DECK["tokens"].items() if k != "pointer_colors"):
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(0.9 * inch, y - 2, f"{name} ({spec['text']})")
        y -= 0.25 * inch
        per_row = 10
        for i in range(spec["count"]):
            cx = 0.9 * inch + (i % per_row) * (size + 4)
            cy = y - size - (i // per_row) * (size + 4)
            c.setStrokeColor(RULE)
            c.setFillColor(white)
            c.circle(cx + size / 2, cy + size / 2, size / 2, stroke=1, fill=1)
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(cx + size / 2, cy + size / 2 - 3, name)
        y -= ((spec["count"] - 1) // per_row + 1) * (size + 4) + 0.25 * inch
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.9 * inch, y - 2, "pointer tokens (2 per player)")
    y -= 0.25 * inch
    for i, color in enumerate(DECK["tokens"]["pointer_colors"]):
        for k in range(2):
            cx = 0.9 * inch + (i * 2 + k) * (size + 6)
            cy = y - size
            c.setFillColor(HexColor(color))
            c.setStrokeColor(RULE)
            c.rect(cx, cy, size, size, stroke=1, fill=1)
            c.setFillColor(white)
            c.setFont("Helvetica-Bold", 7)
            c.drawCentredString(cx + size / 2, cy + size / 2 - 2, "origin/main")
    c.showPage()


# ---------- assemble ----------

def main():
    cards = build_cards()
    counts = {k: sum(1 for kind, _ in cards if kind == k) for k in ("commit", "command", "incident", "ticket", "role")}
    pages = -(-len(cards) // (COLS * ROWS))
    c = canvas.Canvas(str(OUT), pagesize=letter)
    c.setTitle(f"{BRAND} print-and-play v{DECK['version']}")
    cover_page(c, counts, pages)
    reference_page(c)
    for i, (_, draw) in enumerate(cards):
        slot = i % (COLS * ROWS)
        if slot == 0:
            cut_marks(c)
        col, row = slot % COLS, slot // COLS
        x = X0 + col * CARD_W
        y = Y0 + (ROWS - 1 - row) * CARD_H
        draw(c, x, y)
        if slot == COLS * ROWS - 1 or i == len(cards) - 1:
            c.showPage()
    token_page(c)
    c.save()
    total = len(cards)
    print(f"wrote {OUT.relative_to(ROOT)}: {total} cards on {pages} pages "
          f"({counts['commit']} commit, {counts['command']} command, {counts['incident']} incidents, "
          f"{counts['ticket']} tickets, {counts['role']} roles, 1 initial) + cover, reference, tokens")


if __name__ == "__main__":
    main()
