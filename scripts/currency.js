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

    // Initialize character currency service promise
    this.characterCurrencyServicePromise = this._initializeCharacterCurrencyService();
  }

  /**
   * Initializes the character currency service
   * @private
   * @returns {Promise<void>}
   */
  async _initializeCharacterCurrencyService() {
    // Import and initialize CharacterCurrencyService
    try {
      const module = await import('./currency-crud.js');
      this.characterCurrencyService = new module.default(this.moduleId, this._baseUnitMultiplier);
    } catch (error) {
      console.error('Failed to initialize CharacterCurrencyService:', error);
    }
  }

  /**
   * Gets the appropriate scale based on currency system settings
   * @returns {number} The scale to use for currency calculations
   * @private
   */
  _getScale() {
    const useModuleCurrency = this._settings.useModuleCurrencySystem ?? false;
    return useModuleCurrency ? this._moduleScale : this._baseUnitMultiplier;
  }

  /**
   * Gets the currency symbol from settings
   * @returns {string} The currency symbol
   * @private
   */
  _getCurrencySymbol() {
    return this._settings.currencySymbol || "$";
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
  async getUserWallet(userId) {
    const useModuleCurrency = this._settings.useModuleCurrencySystem ?? false;
    
    if (!useModuleCurrency) {
      await this.characterCurrencyServicePromise;
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
    const useModuleCurrency = this._settings.useModuleCurrencySystem ?? false;
    
    if (!useModuleCurrency) {
      await this.characterCurrencyServicePromise;
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
    
    const denominations = this._settings.currencyDenominations || [];

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
  async refreshSettings(newSettings = {}) {
    this._settings = { ...this._settings, ...newSettings };
    
    const denominations = this._settings.currencyDenominations || [];
    
    this._baseUnitMultiplier = _calculateBaseUnitMultiplier(denominations);
    
    // Update character currency service with new multiplier
    await this.characterCurrencyServicePromise;
    if (this.characterCurrencyService) {
      this.characterCurrencyService.baseUnitMultiplier = this._baseUnitMultiplier;
    }
  }

  /**
   * Gets an actor's wallet balance
   * @param {string} actorId - The actor ID
   * @returns {number} The actor's wallet balance
   */
  async getActorWallet(actorId) {
    const useModuleCurrency = this._settings.useModuleCurrencySystem ?? false;
    
    if (!useModuleCurrency) {
      await this.characterCurrencyServicePromise;
      return this.characterCurrencyService?.getCharacterSheetCurrency(actorId) || 0;
    }
    
    // For module currency, we need to find the actor's owner and use their wallet
    const actor = game.actors.get(actorId);
    if (!actor) return 0;
    
    // Find the primary owner of this actor
    const ownerIds = Object.entries(actor.ownership || {})
      .filter(([userId, level]) => level >= 3 && userId !== "default")
      .map(([userId]) => userId);
    
    if (ownerIds.length === 0) return 0;
    
    // Use the first owner's wallet for module currency
    const user = game.users.get(ownerIds[0]);
    const scale = this._getScale();
    const scaledAmount = Number(user?.getFlag(this.moduleId, "wallet")) || 0;
    return scaledAmount / scale;
  }

  /**
   * Sets an actor's wallet balance
   * @param {string} actorId - The actor ID
   * @param {number} amount - The new wallet amount
   * @returns {Promise<boolean>} True if successful
   */
  async setActorWallet(actorId, amount) {
    const useModuleCurrency = this._settings.useModuleCurrencySystem ?? false;
    
    if (!useModuleCurrency) {
      await this.characterCurrencyServicePromise;
      return await this.characterCurrencyService?.setCharacterSheetCurrency(actorId, amount) || false;
    }
    
    // For module currency, we need to find the actor's owner and update their wallet
    const actor = game.actors.get(actorId);
    if (!actor) return false;
    
    // Find the primary owner of this actor
    const ownerIds = Object.entries(actor.ownership || {})
      .filter(([userId, level]) => level >= 3 && userId !== "default")
      .map(([userId]) => userId);
    
    if (ownerIds.length === 0) return false;
    
    // Update the first owner's wallet for module currency
    const user = game.users.get(ownerIds[0]);
    const scale = this._getScale();
    const scaledAmount = Math.max(0, Math.round((Number(amount) || 0) * scale));
    const result = await user?.setFlag(this.moduleId, "wallet", scaledAmount);
    return !!result;
  }

  /**
   * Initializes missing currency denominations for all actors without affecting existing coins
   * @returns {Promise<void>}
   */
  async initializeMissingActorCoins() {
    await this.characterCurrencyServicePromise;
    if (!this.characterCurrencyService) {
      throw new Error('Character currency service not initialized');
    }
    return await this.characterCurrencyService.initializeMissingActorCoins();
  }
}

export { isNonNegInt };