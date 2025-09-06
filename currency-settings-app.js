/**
 * @file Currency settings application for configuring the module's financial system
 * @description Allows GMs to define currency names and denominations for the module's wallet system
 */

/**
 * @class CurrencySettingsApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for managing currency settings
 */
class CurrencySettingsApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'currency-settings',
    tag: 'form',
    window: {
      title: 'Currency Settings',
      icon: 'fas fa-money-bill-wave'
    },
    position: {
      width: 500,
      height: "auto"
    },
    classes: ['gurps-instant-bazaar']
  };

  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/currency-settings.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object
   */
  async _prepareContext() {
    // Load the current state of the module currency system setting
    const useModuleCurrencySystem = game.settings.get(VendorWalletSystem.ID, 'useModuleCurrencySystem');
    const optimizeOnConstruct = game.settings.get(VendorWalletSystem.ID, 'optimizeOnConstruct');
    const requireGMApproval = game.settings.get(VendorWalletSystem.ID, 'requireGMApproval');
    const automaticSellPercentage = game.settings.get(VendorWalletSystem.ID, 'automaticSellPercentage');
    const currencyName = game.settings.get(VendorWalletSystem.ID, 'currencyName');
    
    // Load saved currency denominations or use defaults
    const denominations = game.settings.get(VendorWalletSystem.ID, 'currencyDenominations') || [
      { name: "Gold Coin", value: 80 },
      { name: "Silver Coin", value: 4 },
      { name: "Copper Piece", value: 0.1 },
      { name: "Copper Farthing", value: 1 }
    ];

    return {
      useModuleCurrencySystem,
      optimizeOnConstruct,
      requireGMApproval,
      automaticSellPercentage,
      currencyName,
      denominations
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   */
  _onRender() {
    this.element.addEventListener('click', this._onClickButton.bind(this));
    this.element.addEventListener('submit', this._onSubmitForm.bind(this));
    
    // Set the checkbox state based on the current setting
    const useModuleCurrencyCheckbox = this.element.querySelector('#useModuleCurrencySystem');
    if (useModuleCurrencyCheckbox) {
      const currentSetting = game.settings.get(VendorWalletSystem.ID, 'useModuleCurrencySystem');
      useModuleCurrencyCheckbox.checked = currentSetting;
    }
    
    const optimizeOnConstructCheckbox = this.element.querySelector('#optimizeOnConstruct');
    if (optimizeOnConstructCheckbox) {
      const currentSetting = game.settings.get(VendorWalletSystem.ID, 'optimizeOnConstruct');
      optimizeOnConstructCheckbox.checked = currentSetting;
    }
    
    // Set the GM approval checkbox state
    const requireGMApprovalCheckbox = this.element.querySelector('#requireGMApproval');
    if (requireGMApprovalCheckbox) {
      const currentSetting = game.settings.get(VendorWalletSystem.ID, 'requireGMApproval');
      requireGMApprovalCheckbox.checked = currentSetting;
      requireGMApprovalCheckbox.addEventListener('change', this._updateAutomaticSellPercentageState.bind(this));
    }
    
    // Set the automatic sell percentage slider
    const automaticSellPercentageSlider = this.element.querySelector('#automaticSellPercentage');
    const sellPercentageValue = this.element.querySelector('#sellPercentageValue');
    if (automaticSellPercentageSlider && sellPercentageValue) {
      const currentSetting = game.settings.get(VendorWalletSystem.ID, 'automaticSellPercentage');
      automaticSellPercentageSlider.value = currentSetting;
      sellPercentageValue.textContent = currentSetting;
      
      automaticSellPercentageSlider.addEventListener('input', (e) => {
        sellPercentageValue.textContent = e.target.value;
      });
    }
    
    // Set the currency name field
    const currencyNameField = this.element.querySelector('#currencyName');
    if (currencyNameField) {
      const currentSetting = game.settings.get(VendorWalletSystem.ID, 'currencyName');
      currencyNameField.value = currentSetting;
    }
    
    // Populate denomination fields with saved data
    this._populateDenominationFields();
    
    // Update automatic sell percentage state based on GM approval setting
    this._updateAutomaticSellPercentageState();
    
    // Ensure warning visibility is updated after initial render
    setTimeout(() => {
      this._updateWarningVisibility();
    }, 100);
  }

  /**
   * Updates the automatic sell percentage controls based on GM approval setting
   */
  _updateAutomaticSellPercentageState() {
    const requireGMApprovalCheckbox = this.element.querySelector('#requireGMApproval');
    const automaticSellGroup = this.element.querySelector('#automaticSellGroup');
    const automaticSellPercentageSlider = this.element.querySelector('#automaticSellPercentage');
    
    if (requireGMApprovalCheckbox && automaticSellGroup && automaticSellPercentageSlider) {
      const isGMApprovalRequired = requireGMApprovalCheckbox.checked;
      
      // Disable/enable the slider based on GM approval setting
      automaticSellPercentageSlider.disabled = isGMApprovalRequired;
      
      // Add visual indication when disabled
      if (isGMApprovalRequired) {
        automaticSellGroup.style.opacity = '0.5';
      } else {
        automaticSellGroup.style.opacity = '1';
      }
    }
  }

  /**
   * Populates the denomination fields with saved data
   */
  _populateDenominationFields() {
    const container = this.element.querySelector('#coinDenominationsContainer');
    if (!container) return;

    // Clear existing dynamic fields (keep the notes and warning)
    const existingFields = container.querySelectorAll('.coin-denomination-item');
    existingFields.forEach(field => field.remove());

    // Get denominations from context
    const context = this._prepareContext();
    context.then(data => {
      const denominations = data.denominations || [];
      
      // Add fields for each saved denomination
      denominations.forEach(denom => {
        this._addCoinDenominationField(denom.name, denom.value);
      });

      // Update warning visibility
      this._updateWarningVisibility();
    });
  }

  /**
   * Handles button clicks for various actions
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickButton(event) {
    // Handle clicks on remove buttons
    if (event.target.classList.contains('remove-coin-denomination') || 
        event.target.closest('.remove-coin-denomination')) {
      const fieldToRemove = event.target.closest('.coin-denomination-item');
      if (fieldToRemove) {
        fieldToRemove.remove();
        this._updateWarningVisibility();
      }
      return;
    }

    const action = event.target.dataset.action || event.target.id;

    switch (action) {
      case 'addCoinDenomination':
        this._addCoinDenominationField();
        this._updateWarningVisibility();
        break;
      case 'apply':
        event.preventDefault();
        await this._saveCurrencySettings();
        break;
      case 'cancel':
        // The onclick in the HBS template handles closing for now
        break;
    }
  }

  /**
   * Handles form submission
   * @param {Event} event - The submit event
   * @returns {Promise<void>}
   */
  async _onSubmitForm(event) {
    event.preventDefault();
    await this._saveCurrencySettings();
  }

  /**
   * Adds a new set of input fields for a coin denomination
   * @param {string} [name=''] - Pre-fill name value
   * @param {number} [value=''] - Pre-fill value
   */
  _addCoinDenominationField(name = '', value = '') {
    const container = this.element.querySelector('#coinDenominationsContainer');
    if (!container) return;

    const newField = document.createElement('div');
    newField.classList.add('form-group', 'coin-denomination-item');
    newField.innerHTML = `
      <div class="form-fields">
        <div class="form-field">
          <label>Coin Name:</label>
          <input type="text" name="coinName" placeholder="e.g., Gold Coin" value="${name}" required>
        </div>
        <div class="form-field">
          <label>Value per Coin:</label>
          <input type="number" name="coinValue" placeholder="e.g., 100" min="1" step="1" value="${value}" required>
        </div>
        <button type="button" class="secondary remove-coin-denomination" title="Remove Coin">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    // Insert the new field at the end of the container
    container.appendChild(newField);

    // Add event listener to the new remove button
    newField.querySelector('.remove-coin-denomination').addEventListener('click', (event) => {
      event.target.closest('.coin-denomination-item').remove();
      this._updateWarningVisibility();
    });

    // Update warning visibility after adding field
    this._updateWarningVisibility();
  }

  /**
   * Updates the visibility of the warning message based on denomination count
   */
  _updateWarningVisibility() {
    const container = this.element.querySelector('#coinDenominationsContainer');
    const warningElement = container?.querySelector('.warning-message');
    const denominationFields = container?.querySelectorAll('.coin-denomination-item');
    
    // Try multiple selectors to find the add button
    let addButton = this.element.querySelector('#addCoinDenomination');
    if (!addButton) {
      addButton = this.element.querySelector('[data-action="addCoinDenomination"]');
    }
    if (!addButton) {
      addButton = this.element.querySelector('button[type="button"]:not(.remove-coin-denomination)');
    }
    
    if (warningElement && denominationFields) {
      const count = denominationFields.length;
      warningElement.style.display = count === 0 ? 'block' : 'none';
      
      // Always show add button - no limit on denominations
      if (addButton) {
        addButton.style.display = 'inline-block';
        const parentElement = addButton.parentElement;
        if (parentElement && parentElement.classList.contains('form-group')) {
          parentElement.style.display = 'block';
        }
      } else {
        console.warn('Add coin button not found. Check template structure.');
      }
    }
  }

  /**
   * Saves the currency settings after validation
   * @returns {Promise<void>}
   */
  async _saveCurrencySettings() {
    // Save the module currency system setting
    const useModuleCurrencyCheckbox = this.element.querySelector('#useModuleCurrencySystem');
    const useModuleCurrencySystem = useModuleCurrencyCheckbox ? useModuleCurrencyCheckbox.checked : true;
    
    const optimizeOnConstructCheckbox = this.element.querySelector('#optimizeOnConstruct');
    const optimizeOnConstruct = optimizeOnConstructCheckbox ? optimizeOnConstructCheckbox.checked : false;
    
    const requireGMApprovalCheckbox = this.element.querySelector('#requireGMApproval');
    const requireGMApproval = requireGMApprovalCheckbox ? requireGMApprovalCheckbox.checked : true;
    
    const automaticSellPercentageSlider = this.element.querySelector('#automaticSellPercentage');
    const automaticSellPercentage = automaticSellPercentageSlider ? parseInt(automaticSellPercentageSlider.value) : 50;
    
    const currencyNameField = this.element.querySelector('#currencyName');
    const currencyName = currencyNameField ? currencyNameField.value.trim() : 'coins';
    
    const container = this.element.querySelector('#coinDenominationsContainer');
    const denominationFields = container?.querySelectorAll('.coin-denomination-item');
    
    if (!denominationFields || denominationFields.length === 0) {
      ui.notifications.error('You must define at least one currency denomination to use the system.');
      this._updateWarningVisibility();
      return;
    }

    const denominations = [];
    const usedNames = new Set();

    // Collect and validate denominations
    for (const field of denominationFields) {
      const nameInput = field.querySelector('input[name="coinName"]');
      const valueInput = field.querySelector('input[name="coinValue"]');
      
      const name = nameInput?.value.trim();
      const value = parseFloat(valueInput?.value);

      // Validate name
      if (!name) {
        ui.notifications.error('All denomination names must be filled in and be unique.');
        return;
      }

      if (usedNames.has(name.toLowerCase())) {
        ui.notifications.error(`Duplicate coin name: "${name}". Each coin must have a unique name.`);
        return;
      }
      usedNames.add(name.toLowerCase());

      // Validate value
      if (isNaN(value) || value <= 0) {
        ui.notifications.error(`Invalid value for "${name}". Values must be positive numbers and unique.`);
        return;
      }

      denominations.push({ name, value });
    }

    // Sort by value (descending) and validate order
    const sortedDenominations = [...denominations].sort((a, b) => b.value - a.value);

    // Validate that values are different
    const values = denominations.map(d => d.value);
    const uniqueValues = new Set(values);
    if (uniqueValues.size !== values.length) {
      ui.notifications.error('Each currency denomination must have a unique value.');
      return;
    }

    // Check if module currency system is enabled and warn about decimal precision
    if (useModuleCurrencySystem) {
      // Calculate base unit multiplier to check decimal precision
      let maxDecimalPlaces = 0;
      for (const denom of sortedDenominations) {
        const valueStr = denom.value.toString();
        const decimalIndex = valueStr.indexOf('.');
        if (decimalIndex !== -1) {
          const decimalPlaces = valueStr.length - decimalIndex - 1;
          maxDecimalPlaces = Math.max(maxDecimalPlaces, decimalPlaces);
        }
      }
      
      const baseUnitMultiplier = Math.pow(10, maxDecimalPlaces);
      
      // If no decimal denominations are defined, warn about rounding
      if (baseUnitMultiplier === 1) {
        const hasSmallDenomination = sortedDenominations.some(d => d.value < 1);
        if (!hasSmallDenomination) {
          ui.notifications.warn(
            'Warning: No decimal denominations (like 0.1 or 0.01) are configured. ' +
            'Values will be rounded to the nearest whole number. ' +
            'Consider adding smaller denominations for precise currency handling.'
          );
        }
      }
    }

    try {
      // Save both the module currency system setting and denominations
      await game.settings.set(VendorWalletSystem.ID, 'useModuleCurrencySystem', useModuleCurrencySystem);
      await game.settings.set(VendorWalletSystem.ID, 'optimizeOnConstruct', optimizeOnConstruct);
      await game.settings.set(VendorWalletSystem.ID, 'requireGMApproval', requireGMApproval);
      await game.settings.set(VendorWalletSystem.ID, 'automaticSellPercentage', automaticSellPercentage);
      await game.settings.set(VendorWalletSystem.ID, 'currencyName', currencyName || 'coins');
      // Save the denominations (sorted by value descending)
      await game.settings.set(VendorWalletSystem.ID, 'currencyDenominations', sortedDenominations);
      
      // Refresh CurrencyManager settings after saving
      if (window.VendorWalletSystem && window.VendorWalletSystem.currencyManager) {
        window.VendorWalletSystem.currencyManager.refreshSettings();
      } else if (window.CurrencyManager) {
        // Try to find and refresh any global CurrencyManager instances
        console.warn("Global VendorWalletSystem.currencyManager not found, settings may need manual refresh");
      }
      
      // Notify user if we had to reorder denominations
      const wasReordered = !denominations.every((denom, index) => 
        denom.value === sortedDenominations[index].value
      );
      if (wasReordered) {
        ui.notifications.info('Currency denominations have been automatically sorted from highest to lowest value for optimal change-making.');
      }
      
      ui.notifications.info('Currency settings saved successfully!');
      this.close();
    } catch (error) {
      console.error('Error saving currency settings:', error);
      ui.notifications.error('Failed to save currency settings. Please try again.');
    }
  }
}

// Expose the application to the global scope so other scripts can access it
window.CurrencySettingsApplication = CurrencySettingsApplication;