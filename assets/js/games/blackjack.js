/**
 * Blackjack — original implementation using the Kenney CC0 playing cards.
 * Hit, stand or double against a dealer that stands on 17.
 */

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'];
const RANK_LABEL = { a: 'Ace', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', j: 'Jack', q: 'Queen', k: 'King' };
const BET = 10;

export default function createGame(api) {
  const wrap = document.createElement('div');
  wrap.className = 'bj-wrap';
  wrap.innerHTML = `
    <div class="bj-top">
      <div class="bj-label">Dealer <span data-total="dealer">—</span></div>
      <div class="bj-hand" data-hand="dealer"></div>
    </div>
    <div class="bj-message" data-message>Place your bet and deal.</div>
    <div class="bj-bottom">
      <div class="bj-label">You <span data-total="player">—</span></div>
      <div class="bj-hand" data-hand="player"></div>
    </div>
    <div class="bj-bar">
      <div class="bj-bank">Chips <strong data-chips>100</strong> · Bet <strong>10</strong></div>
      <div class="bj-actions">
        <button class="board-btn" type="button" data-act="hit">Hit</button>
        <button class="board-btn" type="button" data-act="stand">Stand</button>
        <button class="board-btn" type="button" data-act="double">Double</button>
        <button class="board-btn" type="button" data-act="deal">New round</button>
      </div>
    </div>`;
  api.area.appendChild(wrap);
  api.initDOM({ aspect: '16 / 10', maxWidth: 900 });

  const dealerHand = wrap.querySelector('[data-hand="dealer"]');
  const playerHand = wrap.querySelector('[data-hand="player"]');
  const dealerTotal = wrap.querySelector('[data-total="dealer"]');
  const playerTotal = wrap.querySelector('[data-total="player"]');
  const messageEl = wrap.querySelector('[data-message]');
  const chipsEl = wrap.querySelector('[data-chips]');
  const buttons = {
    hit: wrap.querySelector('[data-act="hit"]'),
    stand: wrap.querySelector('[data-act="stand"]'),
    double: wrap.querySelector('[data-act="double"]'),
    deal: wrap.querySelector('[data-act="deal"]'),
  };

  let deck = [];
  let dealer = [];
  let player = [];
  let chips = Number(api.storageGet('chips', 100)) || 100;
  let bet = BET;
  let phase = 'idle';
  let holeHidden = true;
  let dealerTimer = 0;
  let message = '';

  function makeDeck() {
    const cards = [];
    for (const suit of SUITS) for (const rank of RANKS) cards.push({ suit, rank });
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  function draw() {
    if (deck.length < 12) deck = makeDeck();
    return deck.pop();
  }

  function total(hand) {
    let sum = 0;
    let aces = 0;
    for (const card of hand) {
      if (card.rank === 'a') {
        sum += 11;
        aces += 1;
      } else if (['j', 'q', 'k'].includes(card.rank)) sum += 10;
      else sum += Number(card.rank);
    }
    while (sum > 21 && aces > 0) {
      sum -= 10;
      aces -= 1;
    }
    return sum;
  }

  function isBlackjack(hand) {
    return hand.length === 2 && total(hand) === 21;
  }

  function cardImage(card, hidden = false) {
    if (hidden) return `<img class="bj-card is-back" src="/assets/img/cards/deck/back.png" alt="Hidden card" width="120" height="168">`;
    return `<img class="bj-card" src="/assets/img/cards/deck/${card.suit}-${card.rank}.png" alt="${RANK_LABEL[card.rank]} of ${card.suit}" width="120" height="168">`;
  }

  function render() {
    dealerHand.innerHTML = dealer.map((card, i) => cardImage(card, holeHidden && i === 1)).join('');
    playerHand.innerHTML = player.map((card) => cardImage(card)).join('');
    dealerTotal.textContent = dealer.length ? (holeHidden ? `${total([dealer[0]])} + ?` : String(total(dealer))) : '—';
    playerTotal.textContent = player.length ? String(total(player)) : '—';
    chipsEl.textContent = String(chips);
    messageEl.textContent = message;
    const canAct = phase === 'player';
    buttons.hit.disabled = !canAct;
    buttons.stand.disabled = !canAct;
    buttons.double.disabled = !canAct || player.length !== 2 || chips < bet;
    buttons.deal.disabled = phase === 'dealer';
    api.setScore(chips, 'Chips');
    api.saveBest(chips);
    api.storageSet('chips', chips);
  }

  function finish(text, payout = 0) {
    phase = 'over';
    chips += payout;
    message = text;
    if (chips < BET) {
      message += ' Bankroll reset to 100.';
      chips = 100;
    }
    render();
    api.sfx(payout > bet ? 'win' : payout > 0 ? 'score' : 'lose');
  }

  function dealerPlay() {
    phase = 'dealer';
    holeHidden = false;
    dealerTimer = 0.55;
    message = 'Dealer reveals the hole card…';
    render();
  }

  function settle() {
    const p = total(player);
    const d = total(dealer);
    const playerBJ = isBlackjack(player);
    const dealerBJ = isBlackjack(dealer);
    if (playerBJ && dealerBJ) finish('Both blackjack — push.', bet);
    else if (playerBJ) finish('Blackjack! You win 3:2.', bet * 2.5);
    else if (dealerBJ) finish('Dealer blackjack — you lose.', 0);
    else if (p > 21) finish('Bust — you lose.', 0);
    else if (d > 21) finish('Dealer busts — you win!', bet * 2);
    else if (p > d) finish(`You win ${p} to ${d}!`, bet * 2);
    else if (p < d) finish(`Dealer wins ${d} to ${p}.`, 0);
    else finish(`Push at ${p} — bet returned.`, bet);
  }

  function dealRound() {
    if (phase === 'dealer') return;
    if (chips < BET) chips = 100;
    bet = BET;
    chips -= bet;
    deck = makeDeck();
    dealer = [draw(), draw()];
    player = [draw(), draw()];
    phase = 'player';
    holeHidden = true;
    message = 'Hit, stand or double.';
    api.sfx('click');
    render();
    if (isBlackjack(player) || isBlackjack(dealer)) {
      dealerPlay();
    }
  }

  function hit() {
    if (phase !== 'player') return;
    player.push(draw());
    api.sfx('click');
    if (total(player) > 21) finish('Bust — you lose.', 0);
    else render();
  }

  function stand() {
    if (phase !== 'player') return;
    dealerPlay();
  }

  function double() {
    if (phase !== 'player' || player.length !== 2 || chips < bet) return;
    chips -= bet;
    bet *= 2;
    player.push(draw());
    api.sfx('click');
    if (total(player) > 21) finish('Bust on the double — you lose.', 0);
    else dealerPlay();
  }

  buttons.hit.addEventListener('click', hit);
  buttons.stand.addEventListener('click', stand);
  buttons.double.addEventListener('click', double);
  buttons.deal.addEventListener('click', dealRound);

  api.loop((dt) => {
    if (dt > 0 && phase === 'dealer' && api.canPlay()) {
      dealerTimer -= dt;
      if (dealerTimer <= 0) {
        if (total(dealer) < 17) {
          dealer.push(draw());
          dealerTimer = 0.55;
          render();
        } else {
          settle();
        }
      }
    }
  });

  function reset() {
    chips = Number(api.storageGet('chips', 100)) || 100;
    phase = 'idle';
    dealer = [];
    player = [];
    holeHidden = true;
    message = 'Place your bet and deal.';
    render();
    api.setStatus('Hit, stand or double · dealer stands on 17');
  }

  reset();
  api.setBest(chips, 'Best');
  api.setStatus('Hit, stand or double · dealer stands on 17');

  return {
    start() { reset(); },
    restart() { dealRound(); },
  };
}
