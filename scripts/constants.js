/**
 * @file Constants for the GURPS Instant Bazaar module
 * @description Centralized constants to ensure consistency across the module
 */

/**
 * Default currency denominations with exact weights
 * This is the single source of truth for default values
 * @type {Array<Object>}
 * @property {string} name - The name of the currency denomination
 * @property {number} value - The value of the denomination in base currency units
 * @property {number} weight - The weight of a single coin in pounds
 */
export const DEFAULT_CURRENCY_DENOMINATIONS = [
  { name: "Gold Coin", value: 80, weight: 0.004 },
  { name: "Silver Coin", value: 4, weight: 0.004 },
  { name: "Copper Farthing", value: 1, weight: 0.008 },
  { name: "Dime", value: 0.1, weight: 0.008 }
];