/**
 * @file Gem distribution application for GMs to distribute gems to players
 * @description Allows Game Masters to distribute optimized gem combinations to player actors
 */

import VendorWalletSystem from './main.js';

/**
 * @class GemDistributionApplication
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 * @description Application for distributing gems to player actors (GM only)
 */
export default class GemDistributionApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(options = {}) {
    super(options);
    /** Bind event handler for later removal */
    this._boundOnClickButton = this._onClickButton.bind(this);
  }

  static DEFAULT_OPTIONS = {
    id: 'gem-distribution',
    tag: 'form',
    window: {
      title: 'Distribute Gems',
      icon: 'fas fa-gem'
    },
    position: {
      width: 500,
    },
    classes: ['gurps-instant-bazaar']
  };
  
  static PARTS = {
    content: {
      template: 'modules/gurps-instant-bazaar/templates/gem-distribution.hbs'
    }
  };

  /**
   * Prepares the context data for rendering the template
   * @returns {Promise<Object>} Context object containing actor data
   */
  async _prepareContext() {
    /** Get actors with their current gem summaries */
    const actorList = game.actors.filter(a => a.hasPlayerOwner);
    const actors = [];
    
    for (const actor of actorList) {
      const gemSummary = VendorWalletSystem.gemManager.getCurrentGemsSummary(actor.id);
      actors.push({
        id: actor.id,
        name: actor.name,
        currentGems: gemSummary
      });
    }

    // Get gem settings - use all available gem types for maximum variety
    const { gemValues } = await import('./gem-data.js');
    const maxAvailableGemTypes = Object.keys(gemValues).length;
    const { numberOfGemVariationsToUse } = VendorWalletSystem.gemManager.getGemVariations();
    
    return { 
      actors,
      hasActors: actors.length > 0,
      maxAvailableGemTypes: maxAvailableGemTypes,
      defaultGemTypes: Math.min(numberOfGemVariationsToUse, maxAvailableGemTypes)
    };
  }

  /**
   * Handles rendering events by setting up event listeners
   * @returns {void}
   */
  _onRender() {
    /** Clean up any existing listeners first */
    this._cleanupListeners();
    
    /** Add the event listener using the bound function */
    this.element.addEventListener('click', this._boundOnClickButton);
    this.element.addEventListener('submit', this._onSubmitForm.bind(this));

    /** Focus on the target value input */
    const targetValueInput = this.element.querySelector('#targetValue');
    if (targetValueInput) {
      targetValueInput.focus();
    }
  }

  /**
   * Cleans up event listeners to prevent duplicates
   * @returns {void}
   */
  _cleanupListeners() {
    if (this.element && this._boundOnClickButton) {
      this.element.removeEventListener('click', this._boundOnClickButton);
    }
  }

  /**
   * Handles form submission
   * @param {Event} event - The submit event
   * @returns {Promise<void>}
   */
  async _onSubmitForm(event) {
    event.preventDefault();
    await this._distributeGems();
  }

  /**
   * Handles button clicks for gem distribution
   * @param {Event} event - The click event
   * @returns {Promise<void>}
   */
  async _onClickButton(event) {
    const action = event.target.dataset.action;
    
    if (action === 'cancel') {
      this.close();
      return;
    }
    
    if (action === 'distribute-gems') {
      event.preventDefault();
      await this._distributeGems();
      return;
    }
  }

  /**
   * Distributes gems to the selected actor
   * @returns {Promise<void>}
   */
  async _distributeGems() {
    /** Only GMs can distribute gems */
    if (!game.user.isGM) {
      ui.notifications.error('Only Game Masters can distribute gems!');
      return;
    }

    const formData = new FormData(this.element);
    
    const selectedActorId = formData.get('selectedActor');
    const targetValue = parseFloat(formData.get('targetValue'));
    const minGemTypes = parseInt(formData.get('minGemTypes')) || 3;
    const maxGemTypesValue = formData.get('maxGemTypes');
    const maxGemTypes = maxGemTypesValue && maxGemTypesValue.trim() !== '' ? parseInt(maxGemTypesValue) : null;

    if (!selectedActorId) {
      ui.notifications.warn('Please select an actor to receive the gems.');
      return;
    }

    if (!targetValue || targetValue <= 0) {
      ui.notifications.warn('Please enter a valid target value greater than zero.');
      return;
    }

    if (maxGemTypes && minGemTypes > maxGemTypes) {
      ui.notifications.warn('Minimum gem types cannot be greater than maximum gem types.');
      return;
    }

    try {
      ui.notifications.info('Calculating and distributing gems...');
      
      const result = await VendorWalletSystem.gemManager.distributeGemsToActor(
        selectedActorId, 
        targetValue,
        minGemTypes,
        maxGemTypes
      );
      
      if (result.success) {
        let message = `Successfully distributed ${result.totalGems} gems to ${result.actorName}!\n`;
        message += `Target: ${VendorWalletSystem.formatCurrency(result.targetValue)} | ` +
                  `Actual: ${VendorWalletSystem.formatCurrency(result.actualValue)} | ` +
                  `Accuracy: ${result.accuracy}% | `;
        message += `Weight: ${result.totalWeight.toFixed(4)} lbs | `;
        message += `Gem Types: ${result.gemTypes} different types (target: ${minGemTypes}-${maxGemTypes || 'unlimited'})`;
        
        // Add actual types used info
        if (result.actualGemTypesUsed) {
          message += ` | Selected: ${result.actualGemTypesUsed} types`;
        }
        
        ui.notifications.info(message);
        
        /** Re-render to update gem summaries */
        this.render(false);
      } else {
        ui.notifications.error(`Failed to distribute gems: ${result.message}`);
      }
    } catch (error) {
      console.error('Error distributing gems:', error);
      ui.notifications.error(`Error distributing gems: ${error.message}`);
    }
  }

  /**
   * Closes the application and cleans up event listeners
   * @param {Object} options - Close options
   * @returns {Promise<any>} Result of the parent close method
   */
  async close(options) {
    /** Clean up event listeners to prevent memory leaks */
    this._cleanupListeners();
    
    return super.close(options);
  }
}