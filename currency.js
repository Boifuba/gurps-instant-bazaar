// currency.js

/**
 * Utilities for a coin system (gold=80, silver=4, copper=1).
 * All arithmetic uses copper as the base unit.
 * @module currency
 */

/**
 * A bag of coins by denomination.
 * @typedef {Object} CoinBag
 * @property {number} [ouro=0]  Count of gold coins (integer ≥ 0).
 * @property {number} [prata=0] Count of silver coins (integer ≥ 0).
 * @property {number} [cobre=0] Count of copper coins (integer ≥ 0).
 */

/**
 * Options controlling whether the wallet auto-normalizes.
 * @typedef {Object} WalletOptions
 * @property {boolean} [optimizeOnConstruct=true]
 *   If `true`, normalize (compact) on construction.
 * @property {boolean} [optimizeOnAdd=true]
 *   If `true`, add and then normalize to the minimal coin count (greedy).
 *   If `false`, preserve exact counts: numbers are added as copper; objects add by key.
 * @property {boolean} [optimizeOnSubtract=true]
 *   If `true`, subtract by total value and normalize the result.
 *   If `false`, spend by breaking larger coins into smaller (gold→silver→copper),
 *   never “promoting” smaller coins into larger ones.
 */

/**
 * Supported denominations in descending order of value.
 * The order is important for the greedy algorithm (which is optimal here).
 * @type {{key: keyof CoinBag, value: number}[]}
 */
export const DENOMS = [
  { key: "ouro",  value: 80 }, // gold
  { key: "prata", value: 4 }, // silver
  { key: "cobre", value: 1  }, // copper
];

/**
 * Checks whether a number is a non-negative integer.
 * @param {number} n
 * @returns {boolean}
 * @example
 * isNonNegInt(5);   // true
 * isNonNegInt(-1);  // false
 * isNonNegInt(3.2); // false
 */
export const isNonNegInt = (n) => Number.isInteger(n) && n >= 0;

/**
 * Returns the total value (in copper units) of a given coin bag.
 * Validates that each field, if present, is a non-negative integer.
 * @param {CoinBag} [coins]
 * @returns {number} Total value in copper.
 * @throws {Error} If any coin count is invalid.
 * @example
 * valueFromCoins({ ouro: 1, prata: 2, cobre: 3 }); // 80 + 40 + 3 = 123
 */
export function valueFromCoins({ ouro = 0, prata = 0, cobre = 0 } = {}) {
  [ouro, prata, cobre].forEach((n, i) => {
    if (!isNonNegInt(n)) {
      const k = ["ouro", "prata", "cobre"][i];
      throw new Error(`Invalid quantity for ${k}: ${n}`);
    }
  });
  return ouro * 80 + prata * 20 + cobre * 1;
}

/**
 * Greedy change-making: decomposes a total (in copper) into the
 * optimal combination (minimal number of coins).
 * @param {number} total Non-negative integer total in copper.
 * @returns {CoinBag} Optimal coin breakdown.
 * @throws {Error} If total is invalid.
 * @example
 * makeChange(328); // { ouro: 4, prata: 0, cobre: 8 }
 */
export function makeChange(total) {
  if (!isNonNegInt(total)) throw new Error(`Invalid total: ${total}`);
  const out = { ouro: 0, prata: 0, cobre: 0 };
  let rest = total;
  for (const { key, value } of DENOMS) {
    out[key] = Math.floor(rest / value);
    rest = rest % value;
  }
  return out;
}

/**
 * Normalizes a coin bag by converting it to total (in copper) and
 * then making optimal change.
 * @param {CoinBag} coins
 * @returns {CoinBag} Normalized (optimal) bag.
 * @example
 * normalizeCoins({ prata: 5, cobre: 10 }); // { ouro: 1, prata: 1, cobre: 10 }
 */
export function normalizeCoins(coins) {
  return makeChange(valueFromCoins(coins));
}

/**
 * A wallet that holds coins and supports add/subtract with optional
 * auto-normalization controls.
 */
export default class Wallet {
  /**
   * Creates a wallet.
   * @param {CoinBag} [coins] Initial coin bag.
   * @param {WalletOptions} [opts] Normalization options.
   * @example
   * // Fully optimized behavior (default)
   * const w1 = new Wallet({ ouro: 0, prata: 5, cobre: 10 });
   * // Preserve exact counts on construct/add/subtract
   * const w2 = new Wallet({ ouro: 1, prata: 0, cobre: 200 },
   *   { optimizeOnConstruct: false, optimizeOnAdd: false, optimizeOnSubtract: false });
   */
  constructor(coins = { ouro: 0, prata: 0, cobre: 0 }, opts = {}) {
    const {
      optimizeOnConstruct = true,
      optimizeOnAdd = true,
      optimizeOnSubtract = true,
    } = opts;
    this._opts = { optimizeOnConstruct, optimizeOnAdd, optimizeOnSubtract };
    this._set(optimizeOnConstruct ? normalizeCoins(coins) : { ...coins });
  }

  /**
   * Internal setter used to assign fields directly.
   * @private
   * @param {CoinBag} param0
   */
  _set({ ouro = 0, prata = 0, cobre = 0 }) {
    this.ouro = ouro; this.prata = prata; this.cobre = cobre;
  }

  /**
   * Total value of the wallet in copper units.
   * @returns {number}
   */
  total() { return valueFromCoins(this); }

  /**
   * Adds either a numeric amount (treated as copper) or a CoinBag.
   * Behavior depends on optimize flags:
   *  - If `optimizeOnAdd` is true (default), converts to total and re-optimizes.
   *  - If false, preserves counts: numbers increase copper; objects add by key.
   * @param {number|CoinBag} arg Amount in copper or a coin bag.
   * @returns {Wallet} This wallet (chainable).
   * @throws {Error} If the value to add is invalid.
   * @example
   * wallet.add(328);                // add 328 copper
   * wallet.add({ prata: 3, cobre: 2 }); // add by denomination
   */
  add(arg) {
    const isNumber = typeof arg === "number";
    const delta = isNumber ? arg : valueFromCoins(arg);
    if (!isNonNegInt(delta)) throw new Error(`Invalid value to add: ${delta}`);

    if (this._opts.optimizeOnAdd) {
      this._set(makeChange(this.total() + delta));
    } else {
      if (isNumber) this.cobre += delta;
      else {
        this.ouro  += arg.ouro  ?? 0;
        this.prata += arg.prata ?? 0;
        this.cobre += arg.cobre ?? 0;
      }
    }
    return this;
  }

  /**
   * Subtracts either a numeric amount (copper) or a CoinBag.
   *  - If `optimizeOnSubtract` is true (default), subtracts by total and re-optimizes.
   *  - If false, spends by **breaking** larger coins down (gold→silver→copper)
   *    and never promotes smaller coins upward.
   * @param {number|CoinBag} arg Amount in copper or a coin bag.
   * @returns {Wallet} This wallet (chainable).
   * @throws {Error} If the value is invalid or funds are insufficient.
   * @example
   * wallet.subtract(615);
   */
  subtract(arg) {
    const delta = typeof arg === "number" ? arg : valueFromCoins(arg);
    if (!isNonNegInt(delta)) throw new Error(`Invalid value to subtract: ${delta}`);
    if (this.total() < delta) {
      throw new Error(`Insufficient funds: short by ${delta - this.total()} (copper).`);
    }

    if (this._opts.optimizeOnSubtract) {
      this._set(makeChange(this.total() - delta));
      return this;
    }

    // "Preserve" mode: spend copper; if needed, break silver into copper,
    // and gold into silver (then copper), never promoting coins.
    let need = delta;

    const spendFrom = (key, amt) => {
      const take = Math.min(this[key], amt);
      this[key] -= take;
      return take;
    };
    const breakPrata = () => {
      if (this.prata <= 0) return false;
      this.prata -= 1; this.cobre += 20; return true;
    };
    const breakOuro = () => {
      if (this.ouro <= 0) return false;
      this.ouro -= 1; this.prata += 4; return true; // 1 gold = 4 silver
    };

    while (need > 0) {
      const used = spendFrom("cobre", need);
      need -= used;
      if (need === 0) break;

      if (this.cobre === 0) {
        if (!breakPrata()) {
          if (!breakOuro()) throw new Error("Insufficient funds (unexpected).");
        }
      }
    }
    return this;
  }

  /**
   * Normalizes the current counts into the optimal combination (minimal coins).
   * @returns {Wallet} This wallet (chainable).
   */
  normalize() {
    this._set(normalizeCoins(this));
    return this;
  }

  /**
   * Returns a plain object snapshot of the wallet.
   * @returns {CoinBag}
   */
  toObject() { return { ouro: this.ouro, prata: this.prata, cobre: this.cobre }; }

  /**
   * Human-readable string with counts and total (copper).
   * @returns {string}
   */
  toString() {
    return `${this.ouro} ouro, ${this.prata} prata, ${this.cobre} cobre (total=${this.total()})`;
  }
}


// [15:50, 04/09/2025] +55 84 9133-4802: let need = delta;
//     let custo = [0,0,0];
//     let cotacao = [DENOMS["ouro"],DENOMS["prata"],DENOMS["cobre"]];
//     for(var i=0;i<3;i++){
//         custo[i] = need/cotacao[i];
//         if(custo[i] > coins[i] ) custo[i] = coins[i];
//         need = need - custo[i]*cotacao[i];
//     }
//     if(need > 0) throw new Error("Insufficient funds (unexpected).");
//     this.ouro = this.ouro-custo[0];
//     this.prata = this.prata-custo[1];
//     this.cobre = this.cobre-custo[2];
// [15:51, 04/09/2025] +55 84 9133-4802: Seria interessante criar um vetor de struct moedas configurável.
// [15:52, 04/09/2025] +55 84 9133-4802: Nem todo cenário usa ouro, prata e cobre.
// [15:52, 04/09/2025] +55 84 9133-4802: e na hora de chamar, se fosse assim, ficaria simplificado
// [15:53, 04/09/2025] +55 84 9133-4802: struct money_unit{
//   var name;
//   var cotation;
//   var abreviation;
// };

// ficaria assim:let need = delta;    
//     for(var i=0;i<currencies.length;i++){
//         let custo = need/correncies[i].cotation;
//         if(custo > this.coins[i] ) custo[i] = this.coins[i];
//         need = need - custo*correncies[i].cotation;
//         this.coins[i] = this.coins[i]-custo;
//     }
//     if(need > 0) throw new Error("Insufficient funds (unexpected).");

// Export for use as ES module
export { Wallet, DENOMS, valueFromCoins, makeChange, normalizeCoins, isNonNegInt };
