import test from 'node:test';
import assert from 'node:assert/strict';
import { transferItems, produceEgg, completeOrderPack, collectCash, collectStationCash, invest, inventoryUsed } from '../src/domain/economy.ts';

const bag = (capacity, corn = 0, egg = 0) => ({ capacity, items: { corn, egg } });
const upgrade = () => ({ id: 'clerk', cost: 70, paid: 0, requires: ['counter'], unlocked: false });

test('mixed cargo capacity limits transfers without losing resources', () => {
  const source = bag(100, 20, 5), target = bag(10, 4, 4);
  assert.equal(transferItems(source, target, 'corn', 20), 2);
  assert.equal(source.items.corn + target.items.corn, 24);
  assert.equal(inventoryUsed(target), 10);
  assert.equal(transferItems(source, target, 'egg', 5), 0);
  assert.equal(source.items.egg, 5);
});

test('full output pauses production and preserves feed', () => {
  const feed = bag(10, 5), output = bag(3, 0, 3);
  assert.equal(produceEgg(feed, output), false);
  assert.equal(feed.items.corn, 5);
  output.items.egg -= 1;
  assert.equal(produceEgg(feed, output), true);
  assert.equal(feed.items.corn, 4);
  assert.equal(output.items.egg, 3);
});

test('orders require a complete pack and do not settle twice', () => {
  const station = { id: 'car', stock: bag(120, 0, 5), pendingCash: 0 };
  const order = { id: 'one', packsRemaining: 1, eggsPerPack: 6, cashPerPack: 10 };
  assert.equal(completeOrderPack(station, order), false);
  assert.equal(station.stock.items.egg, 5);
  station.stock.items.egg += 1;
  assert.equal(completeOrderPack(station, order), true);
  assert.equal(completeOrderPack(station, order), false);
  assert.equal(station.pendingCash, 10);
});

test('earned cash remains at counter until collected', () => {
  const station = { id: 'car', stock: bag(120, 0, 6), pendingCash: 0 };
  const wallet = { cash: 0 };
  completeOrderPack(station, { id: 'one', packsRemaining: 1, eggsPerPack: 6, cashPerPack: 10 });
  assert.equal(wallet.cash, 0);
  assert.equal(collectStationCash(station, wallet, 4), 4);
  assert.equal(station.pendingCash, 6);
  assert.equal(wallet.cash, 4);
  assert.equal(collectStationCash(station, wallet, 100), 6);
  assert.equal(collectStationCash(station, wallet, 100), 0);
  assert.equal(wallet.cash, 10);
});

test('partial investment resumes, respects prerequisites, and unlocks once', () => {
  const wallet = { cash: 50 }, target = upgrade();
  assert.deepEqual(invest(wallet, target, 100, new Set()), { paid: 0, completed: false });
  assert.equal(wallet.cash, 50);
  assert.deepEqual(invest(wallet, target, 100, new Set(['counter'])), { paid: 50, completed: false });
  assert.equal(target.paid, 50);
  wallet.cash = 30;
  assert.deepEqual(invest(wallet, target, 100, new Set(['counter'])), { paid: 20, completed: true });
  assert.equal(wallet.cash, 10);
  assert.deepEqual(invest(wallet, target, 100, new Set(['counter'])), { paid: 0, completed: false });
  assert.equal(wallet.cash, 10);
});

test('invalid quantities and overflowing cash fail before mutation', () => {
  const a = bag(10, 5), b = bag(10);
  assert.throws(() => transferItems(a, b, 'corn', -1), RangeError);
  assert.throws(() => transferItems(a, b, 'corn', 0.5), RangeError);
  assert.equal(a.items.corn, 5);
  const pile = { cash: 1 }, wallet = { cash: Number.MAX_SAFE_INTEGER };
  assert.throws(() => collectCash(pile, wallet, 1), RangeError);
  assert.equal(pile.cash, 1);
  assert.equal(wallet.cash, Number.MAX_SAFE_INTEGER);
});

test('repeated competing transfers preserve totals and capacities', () => {
  const source = bag(100, 61, 39), a = bag(17), b = bag(23);
  for (let i = 0; i < 1000; i++) {
    const item = i % 2 === 0 ? 'corn' : 'egg';
    transferItems(source, a, item, 3);
    transferItems(source, b, item, 5);
    transferItems(a, source, item, 2);
    transferItems(b, source, item, 4);
    assert.equal(source.items.corn + a.items.corn + b.items.corn, 61);
    assert.equal(source.items.egg + a.items.egg + b.items.egg, 39);
    [source, a, b].forEach(inventoryUsed);
  }
});

test('bootstrap through production, sale, collection and first investment', () => {
  const wallet = { cash: 0 }, initial = { cash: 50 };
  const counter = { id: 'counter', cost: 50, paid: 0, requires: [], unlocked: false };
  collectCash(initial, wallet, 50);
  assert.equal(invest(wallet, counter, 50, new Set()).completed, true);
  const cargo = bag(60, 6), feed = bag(120), ground = bag(180);
  const station = { id: 'car', stock: bag(120), pendingCash: 0 };
  transferItems(cargo, feed, 'corn', 6);
  for (let i = 0; i < 6; i++) assert.equal(produceEgg(feed, ground), true);
  transferItems(ground, cargo, 'egg', 6);
  transferItems(cargo, station.stock, 'egg', 6);
  assert.equal(completeOrderPack(station, { id: 'first', packsRemaining: 1, eggsPerPack: 6, cashPerPack: 10 }), true);
  collectStationCash(station, wallet, 10);
  assert.equal(wallet.cash, 10);
  assert.equal(feed.items.corn + ground.items.egg + inventoryUsed(cargo) + inventoryUsed(station.stock), 0);
});
