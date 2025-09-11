/**
 * @file UI integrations and hooks
 * @description Handles UI modifications and integrations with FoundryVTT interface
 */

import PlayerWalletApplication from './player-wallet-app.js';

/**
 * Adds a wallet button to the player list interface
 * @param {Application} app - The FoundryVTT application
 * @param {jQuery} html - The HTML element
 * @returns {void}
 */
export function addPlayerWalletButton(app, html) {
  const button = $(`<button class="wallet-button"><i class="fas fa-wallet"></i> Wallet</button>`);
  button.on('click', () => new PlayerWalletApplication().render(true));
  html.find('.player-list').before(button);
}

/**
 * Initializes UI integrations by registering hooks
 * @returns {void}
 */
export function initializeUIIntegrations() {
  // Add wallet button to player list
  Hooks.on('renderPlayerList', addPlayerWalletButton);
}