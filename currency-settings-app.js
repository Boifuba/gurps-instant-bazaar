/**
 * @file Currency settings application for configuring the module's financial system
 * @description Allows GMs to define currency names and denominations for the module's wallet system
 */

/**
 * Default currency denominations with exact weights
 * This is the single source of truth for default values
 */
const DEFAULT_CURRENCY_DENOMINATIONS = [
  { name: "Gold Coin", value: 80, weight: 0.004 },
  { name: "Silver Coin", value: 4, weight: 0.004 },
  { name: "Copper Farthing", value: 1, weight: 0.008 },
  { name: "Dime", value: 0.1, weight: 0.008 }
];



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
    // Load saved currency denominations or use defaults
    const denominations = game.settings.get(VendorWalletSystem.ID, 'currencyDenominations') || DEFAULT_CURRENCY_DENOMINATIONS;
    
    // Process denominations to ensure proper weights
    const processedDenominations = denominations.map(denom => {
      // If weight is missing, find the correct weight from defaults
      if (denom.weight === undefined || denom.weight === null) {
        const defaultMatch = DEFAULT_CURRENCY_DENOMINATIONS.find(def => def.name === denom.name);
        return {
          ...denom,
          weight: defaultMatch ? defaultMatch.weight : 0
        };
      }
      return denom;
    });

    // Debug log to verify denominations are loaded with weight values
    console.log('Denominações de moeda carregadas:', processedDenominations);

    return {
      denominations: processedDenominations
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   */
  _onRender() {
    this.element.addEventListener('click', this._onClickButton.bind(this));
    this.element.addEventListener('submit', this._onSubmitForm.bind(this));
    // Populate denomination fields with saved data
    this._populateDenominationFields();
    
    // Ensure warning visibility is updated after initial render
    setTimeout(() => {
      this._updateWarningVisibility();
    }, 100);
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

    // Load saved currency denominations or use defaults
    const denominations = game.settings.get(VendorWalletSystem.ID, 'currencyDenominations') || DEFAULT_CURRENCY_DENOMINATIONS;
    
    // Ensure all denominations have a weight property with proper default
    const processedDenominations = denominations.map(denom => {
      if (denom.weight === undefined || denom.weight === null) {
        const defaultMatch = DEFAULT_CURRENCY_DENOMINATIONS.find(def => def.name === denom.name);
        return {
          ...denom,
          weight: defaultMatch ? defaultMatch.weight : 0
        };
      }
      return denom;
    });
    
    // Add fields for each saved denomination
    processedDenominations.forEach(denom => {
      console.log(`Adicionando campo para: ${denom.name}, valor: ${denom.value}, peso: ${denom.weight}`);
      this._addCoinDenominationField(denom.name, denom.value, denom.weight);
    });

    // Update warning visibility
    this._updateWarningVisibility();
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
        this.close();
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
   * @param {number} [weight=''] - Pre-fill weight value
   */
  _addCoinDenominationField(name = '', value = '', weight = '') {
    const container = this.element.querySelector('#coinDenominationsContainer');
    if (!container) return;

    console.log(`Adicionando campo - Nome: ${name}, Valor: ${value}, Peso: ${weight}`);
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
          <input type="number" name="coinValue" placeholder="e.g., 100" min="0.01" step="0.01" value="${value}" required>
        </div>
        <div class="form-field">
          <label>Weight per Coin:</label>
          <input type="number" name="coinWeight" placeholder="0.004" min="0" step="0.001" value="${weight}" required>
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
      const weightInput = field.querySelector('input[name="coinWeight"]');
      
      const name = nameInput?.value.trim();
      const value = parseFloat(valueInput?.value);
      const weight = parseFloat(weightInput?.value);

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

      // Validate weight
      if (isNaN(weight) || weight < 0) {
        ui.notifications.error(`Invalid weight for "${name}". Weight must be a non-negative number.`);
        return;
      }

      denominations.push({ name, value, weight });
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

    try {
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