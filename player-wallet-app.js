/**
 * @file Player wallet application for viewing wallet balance and available vendors
 * @description Allows players to view their wallet balance and browse available vendors
 */

/**
 * @class PlayerWalletApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for displaying player wallet and available vendors
 */
class PlayerWalletApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'player-wallet',
    tag: 'form',
    window: {
      title: 'Player Wallet',
      icon: 'fas fa-wallet'
    },
    position: {
      width: 400
    },
    classes: ['gurps-birosca'],
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-birosca/player-wallet.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing wallet and vendor data
   */
  async _prepareContext() {
    const wallet = VendorWalletSystem.getUserWallet(game.user.id);
    const allVendors = VendorWalletSystem.getVendors();
    
    const vendors = Object.entries(allVendors)
      .filter(([id, vendor]) => vendor.active)
      .map(([id, vendor]) => ({
        id,
        name: vendor.name,
        itemCount: vendor.items.length
      }));
    
    return {
      wallet,
      vendors
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {Promise<void>}
   */
  async _onRender() {
    this.element.addEventListener('click', this._onClickVendor.bind(this));
  }

  /**
   * Handles vendor button clicks to open vendor display
   * @param {Event} event - The click event
   */
  _onClickVendor(event) {
    const button = event.target.closest('button[data-vendor-id]');
    if (!button) return;
    
    const vendorId = button.dataset.vendorId;
    new VendorDisplayApplication({ vendorId }).render(true);
  }
}

window.PlayerWalletApplication = PlayerWalletApplication;