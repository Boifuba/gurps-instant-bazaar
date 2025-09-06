/**
 * @file GM Tools application for accessing all GM-only functionality
 * @description Main application that provides access to money management, vendor creation, and vendor management
 */

/**
 * @class GMToolsApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Main GM tools application that provides access to all GM functionality
 */
class GMToolsApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gm-tools',
    tag: 'form',
    window: {
      title: 'GM Tools',
      icon: 'fas fa-cogs'
    },
    position: {
      width: 400,
    },
    classes: ['gurps-instant-bazaar']
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/gm-tools.hbs'
    }
  };

  /**
   * Handles rendering events by setting up event listeners
   * @returns {void}
   */
  _onRender() {
    this.element.addEventListener('click', this._onClickTool.bind(this));
  }

  /**
   * Handles tool button clicks to open specific applications
   * @param {Event} event - The click event
   * @returns {void}
   */
  _onClickTool(event) {
    const tool = event.target.dataset.tool;
    switch (tool) {
      case 'money-management':
        new MoneyManagementApplication().render(true);
        break;
      case 'vendor-creation':
        new VendorCreationApplication().render(true);
        break;
      case 'vendor-manager':
        new VendorManagerApplication().render(true);
        break;
      case 'currency-settings':
        new CurrencySettingsApplication().render(true);
        break;
    }
  }
}

window.GMToolsApplication = GMToolsApplication;