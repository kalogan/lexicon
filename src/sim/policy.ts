/**
 * sim/policy — the BOT's decision rules. Word choice is fixed (greedy: play the
 * highest-scoring legal word each play — see sim/solver), so the interesting
 * lever is the SHOP policy: which relic to buy given the coins on hand and the
 * shelf offered. Comparing a few shop policies is how we tell a relic that's
 * "always taken and always in wins" (dominant) from one that's "offered but
 * never bought / never helps" (dead).
 *
 * A policy is deliberately simple + deterministic given its inputs — the bot is
 * a MEASURING STICK, not an optimal player. If a relic still shows huge lift
 * under a naive buyer, that's a strong dominance signal.
 */
import type { Card } from "../run/engine.js";
import type { ShopRelic } from "../ChallengeShop.js";

export interface ShopContext {
  coins: number;
  offered: readonly ShopRelic[];
  owned: readonly Card[];
}

/** A shop policy returns the relic to buy (or null to skip). Called repeatedly
 *  until it returns null or nothing is affordable. */
export type ShopPolicy = {
  id: string;
  label: string;
  pickBuy(ctx: ShopContext): ShopRelic | null;
};

const affordable = (ctx: ShopContext) => ctx.offered.filter((r) => r.price <= ctx.coins);

/** Buy the most expensive affordable relic (proxy for "rarest / best"). */
export const BUY_PRICIEST: ShopPolicy = {
  id: "priciest",
  label: "Buy most expensive affordable relic",
  pickBuy(ctx) {
    const aff = affordable(ctx);
    if (aff.length === 0) return null;
    return aff.reduce((best, r) => (r.price > best.price ? r : best));
  },
};

/** Buy the cheapest affordable relic (spreads coins across more relics). */
export const BUY_CHEAPEST: ShopPolicy = {
  id: "cheapest",
  label: "Buy cheapest affordable relic",
  pickBuy(ctx) {
    const aff = affordable(ctx);
    if (aff.length === 0) return null;
    return aff.reduce((best, r) => (r.price < best.price ? r : best));
  },
};

/** Buy everything affordable, cheapest first (max relic count — greedy hoarder).
 *  Returns the cheapest each call so the loop drains the shelf. */
export const BUY_ALL: ShopPolicy = {
  id: "buy-all",
  label: "Buy every affordable relic (cheapest first)",
  pickBuy(ctx) {
    return BUY_CHEAPEST.pickBuy(ctx);
  },
};

export const SHOP_POLICIES: readonly ShopPolicy[] = [BUY_PRICIEST, BUY_CHEAPEST, BUY_ALL];
