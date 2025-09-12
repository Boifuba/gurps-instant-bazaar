/**
 * @file Module settings registration
 * @description Handles all module settings registration for FoundryVTT
 */

import { DEFAULT_CURRENCY_DENOMINATIONS, DEFAULT_GEM_VARIATIONS } from './constants.js';
import { gemValues, caratSizes } from './gem-data.js';

/**
 * Registers all module settings with FoundryVTT
 * @param {string} moduleId - The module identifier
 * @returns {void}
 */
export function registerModuleSettings(moduleId) {
  game.settings.register(moduleId, 'vendors', {
    name: 'Vendors Data',
    scope: 'world',
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(moduleId, 'useModuleCurrencySystem', {
    name: 'Use Module Currency System',
    hint: 'The module will manage all money, regardless of what\'s on the player\'s character sheet.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(moduleId, 'currencyName', {
    name: 'Main Currency Name',
    hint: 'Name for the main currency (e.g., dollars, credits, coins).',
    scope: 'world',
    config: true,
    type: String,
    default: 'coins'
  });

  game.settings.register(moduleId, 'currencySymbol', {
    name: 'Currency Symbol',
    hint: 'Symbol to display before currency amounts (e.g., $, R$, €, ¥).',
    scope: 'world',
    config: true,
    type: String,
    default: '$'
  });

  game.settings.register(moduleId, 'currencyDenominations', {
    name: 'Currency Denominations',
    scope: 'world',
    config: false,
    type: Array,
    default: DEFAULT_CURRENCY_DENOMINATIONS
  });

  game.settings.register(moduleId, 'optimizeOnConstruct', {
    name: 'Optimize On Construct',
    hint: 'When enabled, wallets will automatically convert coins to the optimal combination (minimal number of coins).',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(moduleId, 'requireGMApproval', {
    name: 'Require GM Approval for Sales',
    hint: 'If enabled, the GM must approve player sale requests.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(moduleId, 'automaticSellPercentage', {
    name: 'Automatic Sell Percentage',
    hint: 'Percentage of item value when selling automatically (when GM approval is disabled).',
    scope: 'world',
    config: true,
    type: Number,
    default: 50,
    range: {
      min: 0,
      max: 100,
      step: 1
    }
  });

  game.settings.register(moduleId, 'debugMode', {
    name: 'Debug Mode',
    hint: 'Enables verbose console logging for debugging purposes.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(moduleId, 'gemBaseValues', {
    name: 'Gem Base Values',
    scope: 'world',
    config: false,
    type: Object,
    default: gemValues
  });

  game.settings.register(moduleId, 'gemCaratSizes', {
    name: 'Gem Carat Sizes',
    scope: 'world',
    config: false,
    type: Array,
    default: caratSizes
  });

  game.settings.register(moduleId, 'gemVariations', {
    name: 'Gem Variations Data',
    scope: 'world',
    config: false,
    type: Array,
    default: DEFAULT_GEM_VARIATIONS
  });

  game.settings.register(moduleId, 'numberOfGemVariationsToUse', {
    name: 'Minimum Gem Types for Distribution',
    hint: 'When distributing gems, the minimum number of different gem types to include (ensures variety).',
    scope: 'world',
    config: true,
    type: Number,
    default: 5,
    range: {
      min: 1,
      max: 15,
      step: 1
    }
  });
}