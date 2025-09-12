/**
 * @file Constants for the  Instant Bazaar module
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

/**
 * Default gem variations with their properties
 * @type {Array<Object>}
 * @property {string} name - The name of the gem
 * @property {number} value - The base value of the gem in base currency units
 * @property {number} weight - The weight of a single gem in pounds
 * @property {string} img - Path to the image icon for the gem
 */
export const DEFAULT_GEM_VARIATIONS = [
  { name: "Ruby", value: 500, weight: 0.01, img: "icons/commodities/gems/gem-faceted-red.webp" },
  { name: "Emerald", value: 400, weight: 0.01, img: "icons/commodities/gems/gem-faceted-green.webp" },
  { name: "Sapphire", value: 300, weight: 0.01, img: "icons/commodities/gems/gem-faceted-blue.webp" },
  { name: "Diamond", value: 1000, weight: 0.005, img: "icons/commodities/gems/gem-faceted-white.webp" },
  { name: "Amethyst", value: 150, weight: 0.01, img: "icons/commodities/gems/gem-faceted-purple.webp" },
  { name: "Topaz", value: 200, weight: 0.01, img: "icons/commodities/gems/gem-faceted-yellow.webp" },
  { name: "Garnet", value: 100, weight: 0.01, img: "icons/commodities/gems/gem-faceted-orange.webp" },
  { name: "Opal", value: 250, weight: 0.008, img: "icons/commodities/gems/gem-rough-white.webp" }
];