/**
 * @file Utility functions and classes for managing currency and wallets
 * @description Core currency management system with wallet operations and denomination handling
 */

import { flattenItemsFromObject } from './utils.js';

/**
 * Validates if a number is a non-negative integer
 * @param {number} n - The number to validate
 * @returns {boolean} True if the number is a non-negative integer
 */
const isNonNegInt = (n) => Number.isInteger(n) && n >= 0;

/**
 * Calculates the base unit multiplier for currency denominations
 * @param {Array} denominations - Array of denomination objects with value properties
 * @returns {number} The multiplier needed to convert all values to integers
 */
export function _calculateBaseUnitMultiplier(denominations) {
  if (!denominations || denominations.length === 0) return 1;
  let maxDecimalPlaces = 0;
  for (const denom of denominations) {
    const valueStr = denom.value.toString();
    const decimalIndex = valueStr.indexOf(".");
    if (decimalIndex !== -1) {
      const decimalPlaces = valueStr.length - decimalIndex - 1;
      maxDecimalPlaces = Math.max(maxDecimalPlaces, decimalPlaces);
    }
  }
  return Math.pow(10, maxDecimalPlaces);
}

/**
 * Calculates the total value of coins based on denominations
 * @param {Object} coins - Object mapping coin names to quantities
 * @param {Array} denominations - Array of denomination objects
 * @returns {number} Total value of all coins
 * @throws {Error} If denominations array is missing or coin quantities are invalid
 */
export function valueFromCoins(coins = {}, denominations = null) {
  if (!denominations || !Array.isArray(denominations)) {
    throw new Error("Denominations array is required");
  }
  let totalValue = 0;
  for (const [coinName, count] of Object.entries(coins)) {
    if (!isNonNegInt(count)) {
      throw new Error(`Invalid quantity for ${coinName}: ${count}`);
    }
    const denomination = denominations.find((d) => d.name === coinName);
    if (denomination) {
      totalValue += count * denomination.value;
    }
  }
  return totalValue;
}

/**
 * Makes change for a given total using optimal coin distribution
 * @param {number} total - The total amount to make change for
 * @param {Array} denominations - Array of denomination objects sorted by value (descending)
 * @returns {Object} Object mapping coin names to quantities
 * @throws {Error} If total is invalid or denominations array is missing
 */
export function makeChange(total, denominations = null) {
  if (!isNonNegInt(total)) throw new Error(`Invalid total: ${total}`);
  if (!denominations || !Array.isArray(denominations)) {
    throw new Error("Denominations array is required");
  }
  const denoms = [...denominations].sort((a, b) => b.value - a.value);
  const out = {};
  let rest = total;
  for (const denomination of denoms) {
    const count = Math.floor(rest / denomination.value);
    out[denomination.name] = count;
    rest = rest % denomination.value;
  }
  return out;
}

/**
 * Normalizes coins to optimal distribution
 * @param {Object} coins - Object mapping coin names to quantities
 * @param {Array} denominations - Array of denomination objects
 * @returns {Object} Normalized coin distribution
 */
function normalizeCoins(coins, denominations = null) {
  return makeChange(valueFromCoins(coins, denominations), denominations);
}

/**
 * Wallet class for managing currency with various optimization options
 */
export class Wallet {
  /**
   * Creates a new Wallet instance
   * @param {Object} coins - Initial coin distribution
   * @param {Object} opts - Wallet options
   * @param {boolean} opts.optimizeOnConstruct - Whether to optimize coins on construction
   * @param {boolean} opts.optimizeOnAdd - Whether to optimize coins when adding
   * @param {boolean} opts.optimizeOnSubtract - Whether to optimize coins when subtracting
   * @param {boolean} opts.spendSmallestFirst - Whether to spend smallest denominations first
   * @param {string} opts.repackAfterSubtract - Repacking strategy after subtraction
   * @param {Array} denominations - Array of denomination objects
   */
  constructor(coins = {}, opts = {}, denominations = null) {
    const {
      optimizeOnConstruct = true,
      optimizeOnAdd = true,
      optimizeOnSubtract = false,
      spendSmallestFirst = true,
      repackAfterSubtract = "up"
    } = opts;

    this._denominations = (denominations || [])
      .slice()
      .sort((a, b) => b.value - a.value);

    this._opts = {
      optimizeOnConstruct,
      optimizeOnAdd,
      optimizeOnSubtract,
      spendSmallestFirst,
      repackAfterSubtract
    };

    this._baseUnitMultiplier = _calculateBaseUnitMultiplier(this._denominations);
    this._assertCanonical();

    const scaled = this._getScaledDenominations();
    this._coins = optimizeOnConstruct ? normalizeCoins(coins, scaled) : { ...coins };
  }

  /**
   * Validates that denominations form a canonical system (each higher denomination is a multiple of lower ones)
   * @throws {Error} If denominations are not canonical
   * @private
   */
  _assertCanonical() {
    const d = this._getScaledDenominations();
    for (let i = 0; i < d.length - 1; i++) {
      const a = d[i].value, b = d[i + 1].value;
      if (a % b !== 0) {
        throw new Error(
          `Non-canonical denominations after scaling: ${d[i].name} (${a}) is not a multiple of ${d[i + 1].name} (${b}).`
        );
      }
    }
  }

  /**
   * Scales a value by the base unit multiplier
   * @param {number} val - Value to scale
   * @returns {number} Scaled value
   * @private
   */
  _getScaledValue(val) { return Math.round(val * this._baseUnitMultiplier); }

  /**
   * Unscales a value by the base unit multiplier
   * @param {number} val - Scaled value to unscale
   * @returns {number} Unscaled value
   * @private
   */
  _getUnscaledValue(val) { return val / this._baseUnitMultiplier; }

  /**
   * Gets denominations scaled to integer values
   * @returns {Array} Array of scaled denomination objects
   * @private
   */
  _getScaledDenominations() {
    return this._denominations
      .map((denom) => ({ ...denom, value: this._getScaledValue(denom.value) }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Sets the wallet's coin distribution
   * @param {Object} coinBag - New coin distribution
   * @private
   */
  _set(coinBag) { this._coins = { ...coinBag }; }

  /**
   * Gets the total value of all coins in the wallet
   * @returns {number} Total wallet value
   */
  total() {
    return valueFromCoins(this._coins, this._getScaledDenominations());
  }

  /**
   * Coalesces smaller denominations into larger ones where possible
   * @param {Object} bag - Coin distribution to coalesce
   * @returns {Object} Coalesced coin distribution
   * @private
   */
  _coalesceUp(bag) {
    const d = this._getScaledDenominations();
    const out = { ...bag };
    for (let i = d.length - 1; i > 0; i--) {
      const lower = d[i], higher = d[i - 1];
      const ratio = Math.floor(higher.value / lower.value);
      if (ratio <= 1) continue;
      const have = out[lower.name] | 0;
      if (have >= ratio) {
        const promote = Math.floor(have / ratio);
        out[lower.name] = have - promote * ratio;
        out[higher.name] = (out[higher.name] | 0) + promote;
      }
    }
    return out;
  }

  /**
   * Breaks one coin of a higher denomination into smaller denominations
   * @param {Object} bag - Coin distribution to modify
   * @param {number} idx - Index of denomination to break
   * @returns {boolean} True if a coin was successfully broken
   * @private
   */
  _breakOne(bag, idx) {
    const d = this._getScaledDenominations();
    if (idx >= d.length - 1) return false;
    const from = d[idx], to = d[idx + 1];
    const cnt = bag[from.name] | 0;
    if (cnt <= 0) return false;
    const ratio = from.value / to.value;
    if (!Number.isInteger(ratio)) {
      throw new Error("Denominations do not allow a clean break (non-integers after scaling).");
    }
    bag[from.name] = cnt - 1;
    bag[to.name] = (bag[to.name] | 0) + ratio;
    return true;
  }

  /**
   * Adds money to the wallet
   * @param {number|Object} arg - Amount to add (number) or coin distribution (object)
   * @returns {Wallet} This wallet instance for chaining
   * @throws {Error} If the amount is invalid
   */
  add(arg) {
    const D = this._getScaledDenominations();
    const isNumber = typeof arg === "number";
    const delta = isNumber ? this._getScaledValue(arg) : valueFromCoins(arg, D);
    if (!isNonNegInt(delta)) throw new Error(`Invalid value to add: ${delta}`);

    if (this._opts.optimizeOnAdd) {
      this._addOptimized(delta, D);
    } else {
      this._addNonOptimized(arg, delta, isNumber, D);
    }
    return this;
  }

  /**
   * Handles optimized addition by converting to optimal coin distribution
   * @param {number} delta - The scaled amount to add
   * @param {Array} denominations - The scaled denominations
   * @private
   */
  _addOptimized(delta, denominations) {
    this._set(makeChange(this.total() + delta, denominations));
  }

  /**
   * Handles non-optimized addition by adding coins directly
   * @param {number|Object} arg - Original argument passed to add()
   * @param {number} delta - The scaled amount to add
   * @param {boolean} isNumber - Whether arg is a number
   * @param {Array} denominations - The scaled denominations
   * @private
   */
  _addNonOptimized(arg, delta, isNumber, denominations) {
    if (isNumber) {
      if (denominations.length > 0) {
        const smallest = denominations[denominations.length - 1];
        const unit = smallest.value;
        const whole = Math.floor(delta / unit);
        const rem = delta % unit;
        this._coins[smallest.name] = (this._coins[smallest.name] || 0) + whole;
        if (rem) {
          const tmp = makeChange(this.total() + rem, denominations);
          this._set(tmp);
        }
      }
    } else {
      for (const [denomName, count] of Object.entries(arg)) {
        this._coins[denomName] = (this._coins[denomName] || 0) + count;
      }
    }
  }

  /**
   * Subtracts money from the wallet
   * @param {number|Object} arg - Amount to subtract (number) or coin distribution (object)
   * @returns {Wallet} This wallet instance for chaining
   * @throws {Error} If the amount is invalid or insufficient funds
   */
  subtract(arg) {
    const D = this._getScaledDenominations();
    const delta = typeof arg === "number" ? this._getScaledValue(arg) : valueFromCoins(arg, D);
    if (!isNonNegInt(delta)) throw new Error(`Invalid value to subtract: ${delta}`);
    const tot = this.total();
    if (tot < delta) throw new Error(`Insufficient funds: short by ${delta - tot} (base units).`);

    if (this._opts.optimizeOnSubtract) {
      this._subtractOptimized(tot, delta, D);
    } else {
      this._subtractNonOptimized(delta, D);
    }
    return this;
  }

  /**
   * Handles optimized subtraction by converting to optimal coin distribution
   * @param {number} total - Current wallet total
   * @param {number} delta - The scaled amount to subtract
   * @param {Array} denominations - The scaled denominations
   * @private
   */
  _subtractOptimized(total, delta, denominations) {
    this._set(makeChange(total - delta, denominations));
  }

  /**
   * Handles non-optimized subtraction with coin breaking logic
   * @param {number} delta - The scaled amount to subtract
   * @param {Array} denominations - The scaled denominations
   * @private
   */
  _subtractNonOptimized(delta, denominations) {
    const work = { ...this._coins };
    let remaining = delta;

    if (this._opts.spendSmallestFirst) {
      remaining = this._subtractSmallestFirst(remaining, denominations, work);
    } else {
      remaining = this._subtractLargestFirst(remaining, denominations, work);
    }

    const result = this._opts.repackAfterSubtract === "up" ? this._coalesceUp(work) : work;
    this._set(result);
  }

  /**
   * Subtracts coins starting from smallest denomination with coin breaking
   * @param {number} remaining - Amount still to subtract
   * @param {Array} denominations - The scaled denominations
   * @param {Object} work - Working copy of coins
   * @returns {number} Remaining amount after subtraction
   * @private
   */
  _subtractSmallestFirst(remaining, denominations, work) {
    while (remaining > 0) {
      let spentThisPass = 0;

      // Process from smallest to largest denomination
      for (let i = denominations.length - 1; i >= 0 && remaining > 0; i--) {
        const name = denominations[i].name, v = denominations[i].value;
        const have = work[name] | 0;
        const take = Math.min(have, Math.floor(remaining / v));
        if (take > 0) {
          work[name] = have - take;
          remaining -= take * v;
          spentThisPass += take * v;
        }
      }

      if (remaining === 0) break;

      if (spentThisPass === 0) {
        let broke = false;
        for (let i = denominations.length - 2; i >= 0; i--) {
          if (this._breakOne(work, i)) { broke = true; break; }
        }
        if (!broke) throw new Error("Insufficient funds (unexpected).");
      }
    }
    return remaining;
  }

  /**
   * Subtracts coins starting from largest denomination without coin breaking
   * @param {number} remaining - Amount still to subtract
   * @param {Array} denominations - The scaled denominations
   * @param {Object} work - Working copy of coins
   * @returns {number} Remaining amount after subtraction
   * @private
   */
  _subtractLargestFirst(remaining, denominations, work) {
    // Process from largest to smallest denomination without breaking coins
    for (let i = 0; i < denominations.length && remaining > 0; i++) {
      const name = denominations[i].name, v = denominations[i].value;
      const have = work[name] | 0;
      const take = Math.min(have, Math.floor(remaining / v));
      if (take > 0) {
        work[name] = have - take;
        remaining -= take * v;
      }
    }
    if (remaining > 0) {
      throw new Error("Need to break higher coins; enable spendSmallestFirst.");
    }
    return remaining;
  }

  /**
   * Normalizes the wallet to optimal coin distribution
   * @returns {Wallet} This wallet instance for chaining
   */
  normalize() {
    this._set(normalizeCoins(this._coins, this._getScaledDenominations()));
    return this;
  }

  /**
   * Returns the wallet's coin distribution as a plain object
   * @returns {Object} Coin distribution object
   */
  toObject() { return { ...this._coins }; }

  /**
   * Returns a string representation of the wallet
   * @returns {string} String representation showing coins and total value
   */
  toString() {
    const coinStrings = [];
    for (const denom of this._denominations) {
      const count = this._coins[denom.name] || 0;
      if (count > 0) coinStrings.push(`${count} ${denom.name}`);
    }
    return `${coinStrings.join(", ")} (total=${this._getUnscaledValue(this.total())})`;
  }
}

/**
 * Currency manager for integrating wallets with Foundry actors and settings
 */
export default class CurrencyManager {
  /**
   * Creates a new CurrencyManager instance
   * @param {string} moduleId - Module identifier used for settings keys
   * @param {Object} settings - Configuration settings object
   * @param {boolean} settings.useModuleCurrencySystem - Whether to use module currency system
   * @param {Array} settings.currencyDenominations - Array of currency denominations
   * @param {string} settings.currencySymbol - Currency symbol for formatting
   */
  constructor(moduleId, settings = {}) {
    this.moduleId = moduleId;
    this._settings = settings;
    
    // Get initial settings from game if not provided
    const denominations = settings.currencyDenominations || 
      game.settings.get(this.moduleId, "currencyDenominations") || [];
    
    this._baseUnitMultiplier = _calculateBaseUnitMultiplier(denominations);
    this._moduleScale = 100; // cents in module mode (no physical coins)

    // Initialize character currency service
    this._initializeCharacterCurrencyService();
  }

  /**
   * Initializes the character currency service
   * @private
   */
  _initializeCharacterCurrencyService() {
    // Import and initialize CharacterCurrencyService
    import('./currency-crud.js').then(module => {
      this.characterCurrencyService = new module.default(this.moduleId, this._baseUnitMultiplier);
    }).catch(error => {
      console.error('Failed to initialize CharacterCurrencyService:', error);
    });
  }

  /**
   * Gets the appropriate scale based on currency system settings
   * @returns {number} The scale to use for currency calculations
   * @private
   */
  _getScale() {
    const useModuleCurrency = this._settings.useModuleCurrencySystem ?? 
      game.settings.get(this.moduleId, "useModuleCurrencySystem");
    return useModuleCurrency ? this._moduleScale : this._baseUnitMultiplier;
  }

  /**
   * Gets the currency symbol from settings
   * @returns {string} The currency symbol
   * @private
   */
  _getCurrencySymbol() {
    return this._settings.currencySymbol || 
      game.settings.get(this.moduleId, "currencySymbol") || "$";
  }

  /**
   * Formats a currency amount for display
   * @param {number} amount - The amount to format
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount) {
    const currencySymbol = this._getCurrencySymbol();

    // Ensure we have a valid number
    let finalAmount = Number(amount);
    if (!Number.isFinite(finalAmount)) {
      finalAmount = 0;
    }

    // Ensure minimum value for display purposes (prevents showing $0.00 for very small amounts)
    if (finalAmount > 0 && finalAmount < 0.01) finalAmount = 0.01;
    
    // Round to 2 decimal places
    finalAmount = Math.round(finalAmount * 100) / 100;
    
    // Format with American standard (1,000.00) and configurable symbol
    const formattedNumber = finalAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `${currencySymbol}${formattedNumber}`;
  }

  /**
   * Parses a currency string into a numeric value
   * @param {string|number} value - The value to parse
   * @returns {number} Parsed numeric value
   */
  parseCurrency(value) {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return 0;
    let s = value.trim();
    s = s.replace(/\s/g, "");
    s = s.replace(/[^\d.,\-]/g, "");
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    let decSep = ".";
    if (lastComma > lastDot) decSep = ",";
    const thouSep = decSep === "." ? "," : ".";
    const reThou = new RegExp("\\" + thouSep, "g");
    s = s.replace(reThou, "");
    if (decSep === ",") s = s.replace(/,/g, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Gets a user's wallet balance
   * @param {string} userId - The user ID
   * @returns {number} The user's wallet balance
   */
  getUserWallet(userId) {
    const useModuleCurrency = this._settings.useModuleCurrencySystem ?? 
      game.settings.get(this.moduleId, "useModuleCurrencySystem");
    
    if (!useModuleCurrency) {
      return this.characterCurrencyService?.getCharacterSheetCurrency(userId) || 0;
    }
    
    const user = game.users.get(userId);
    const scale = this._getScale();
    const scaledAmount = Number(user?.getFlag(this.moduleId, "wallet")) || 0;
    return scaledAmount / scale;
  }

  /**
   * Sets a user's wallet balance
   * @param {string} userId - The user ID
   * @param {number} amount - The new wallet amount
   * @returns {Promise<boolean>} True if successful
   */
  async setUserWallet(userId, amount) {
    const useModuleCurrency = this._settings.useModuleCurrencySystem ?? 
      game.settings.get(this.moduleId, "useModuleCurrencySystem");
    
    if (!useModuleCurrency) {
      return await this.characterCurrencyService?.setCharacterSheetCurrency(userId, amount) || false;
    }
    
    const user = game.users.get(userId);
    const scale = this._getScale();
    const scaledAmount = Math.max(0, Math.round((Number(amount) || 0) * scale));
    const result = await user?.setFlag(this.moduleId, "wallet", scaledAmount);
    return !!result;
  }

  /**
   * Gets a breakdown of module currency by denomination
   * @param {string} userId - The user ID
   * @returns {Array} Array of denomination breakdown objects
   */
  getModuleCurrencyBreakdown(userId) {
    const unscaledTotalValue = this.getUserWallet(userId);
    const scaledTotalValue = Math.round(unscaledTotalValue * this._getScale());
    
    const denominations = this._settings.currencyDenominations || 
      game.settings.get(this.moduleId, "currencyDenominations") || [];

    if (denominations.length === 0) return [];

    const scaledDenominations = denominations.map((denom) => ({
      ...denom,
      value: denom.value * this._getScale()
    }));

    const coinBag = makeChange(scaledTotalValue, scaledDenominations);
    const breakdown = [];
    for (const denomination of denominations) {
      const count = coinBag[denomination.name] || 0;
      if (count > 0) {
        breakdown.push({
          name: denomination.name,
          count: count,
          value: denomination.value
        });
      }
    }
    return breakdown;
  }

  /**
   * Refreshes the currency manager settings
   * @param {Object} newSettings - New settings to apply
   */
  refreshSettings(newSettings = {}) {
    this._settings = { ...this._settings, ...newSettings };
    
    const denominations = this._settings.currencyDenominations || 
      game.settings.get(this.moduleId, "currencyDenominations") || [];
    
    this._baseUnitMultiplier = _calculateBaseUnitMultiplier(denominations);
    
    // Update character currency service with new multiplier
    if (this.characterCurrencyService) {
      this.characterCurrencyService.baseUnitMultiplier = this._baseUnitMultiplier;
    }
  }

  /**
   * Initializes missing currency denominations for all actors without affecting existing coins
   * @returns {Promise<void>}
   */
  async initializeMissingActorCoins() {
    if (!this.characterCurrencyService) {
      throw new Error('Character currency service not initialized');
    }
    return await this.characterCurrencyService.initializeMissingActorCoins();
  }
}

export { isNonNegInt };