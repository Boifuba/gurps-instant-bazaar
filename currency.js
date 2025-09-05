// currency.js

/**
 * Utilities for a coin system (gold=80, silver=4, copper=1).
 * All arithmetic uses copper as the base unit.
 * @module currency
 */

/**
 * A bag of coins by denomination.
 * @typedef {Object} CoinBag
 * @property {number} [ouro=0]  Count of gold coins (integer ≥ 0).
 * @property {number} [prata=0] Count of silver coins (integer ≥ 0).
 * @property {number} [cobre=0] Count of copper coins (integer ≥ 0).
 */

/**
 * Options controlling whether the wallet auto-normalizes.
 * @typedef {Object} WalletOptions
 * @property {boolean} [optimizeOnConstruct=true]
 *   If `true`, normalize (compact) on construction.
 * @property {boolean} [optimizeOnAdd=true]
 *   If `true`, add and then normalize to the minimal coin count (greedy).
 *   If `false`, preserve exact counts: numbers are added as copper; objects add by key.
 * @property {boolean} [optimizeOnSubtract=true]
 *   If `true`, subtract by total value and normalize the result.
 *   If `false`, spend by breaking larger coins into smaller (gold→silver→copper),
 *   never "promoting" smaller coins into larger ones.
 */

/**
 * Supported denominations in descending order of value.
 * The order is important for the greedy algorithm (which is optimal here).
 * @type {{key: keyof CoinBag, value: number}[]}
 */

/**
 * Checks whether a number is a non-negative integer.
 * @param {number} n
 * @returns {boolean}
 * @example
 * isNonNegInt(5);   // true
 * isNonNegInt(-1);  // false
 * isNonNegInt(3.2); // false
 */
const isNonNegInt = (n) => Number.isInteger(n) && n >= 0;

/**
 * Returns the total value (in copper units) of a given coin bag.
 * Validates that each field, if present, is a non-negative integer.
 * @param {CoinBag} [coins]
 * @param {Array} [denominations] - Array of denomination objects with name and value
 * @returns {number} Total value in copper.
 * @throws {Error} If any coin count is invalid.
 * @example
 * valueFromCoins({ ouro: 1, prata: 2, cobre: 3 }); // 80 + 8 + 3 = 91
 */
function valueFromCoins({ ouro = 0, prata = 0, cobre = 0 } = {}, denominations = null) {
  [ouro, prata, cobre].forEach((n, i) => {
    if (!isNonNegInt(n)) {
      const k = ["ouro", "prata", "cobre"][i];
      throw new Error(`Invalid quantity for ${k}: ${n}`);
    }
  });
  
  if (denominations && denominations.length >= 3) {
    return ouro * denominations[0].value + prata * denominations[1].value + cobre * denominations[2].value;
  }
  // Default values if no denominations provided
  return ouro * 80 + prata * 4 + cobre * 1;
}

/**
 * Greedy change-making: decomposes a total (in copper) into the
 * optimal combination (minimal number of coins).
 * @param {number} total Non-negative integer total in copper.
 * @param {Array} [denominations] - Array of denomination objects with name and value
 * @returns {CoinBag} Optimal coin breakdown.
 * @throws {Error} If total is invalid.
 * @example
 * makeChange(328); // { ouro: 4, prata: 0, cobre: 8 }
 */
function makeChange(total, denominations = null) {
  if (!isNonNegInt(total)) throw new Error(`Invalid total: ${total}`);
  const out = { ouro: 0, prata: 0, cobre: 0 };
  let rest = total;
  
  // Use provided denominations or default values
  const denoms = denominations && denominations.length >= 3 ? [
    { key: "ouro", value: denominations[0].value },
    { key: "prata", value: denominations[1].value },
    { key: "cobre", value: denominations[2].value }
  ] : [
    { key: "ouro", value: 80 },
    { key: "prata", value: 4 },
    { key: "cobre", value: 1 }
  ];
  
  for (const { key, value } of denoms) {
    out[key] = Math.floor(rest / value);
    rest = rest % value;
  }
  return out;
}

/**
 * Normalizes a coin bag by converting it to total (in copper) and
 * then making optimal change.
 * @param {CoinBag} coins
 * @param {Array} [denominations] - Array of denomination objects with name and value
 * @returns {CoinBag} Normalized (optimal) bag.
 * @example
 * normalizeCoins({ prata: 5, cobre: 10 }); // { ouro: 0, prata: 7, cobre: 2 }
 */
function normalizeCoins(coins, denominations = null) {
  return makeChange(valueFromCoins(coins, denominations), denominations);
}

/**
 * A wallet that holds coins and supports add/subtract with optional
 * auto-normalization controls.
 */
class Wallet {
  /**
   * Creates a wallet.
   * @param {CoinBag} [coins] Initial coin bag.
   * @param {WalletOptions} [opts] Normalization options.
   * @param {Array} [denominations] Array of denomination objects with name and value
   * @example
   * // Fully optimized behavior (default)
   * const w1 = new Wallet({ ouro: 0, prata: 5, cobre: 10 });
   * // Preserve exact counts on construct/add/subtract
   * const w2 = new Wallet({ ouro: 1, prata: 0, cobre: 200 },
   *   { optimizeOnConstruct: false, optimizeOnAdd: false, optimizeOnSubtract: false });
   */
  constructor(coins = { ouro: 0, prata: 0, cobre: 0 }, opts = {}, denominations = null) {
    const {
      optimizeOnConstruct = true,
      optimizeOnAdd = true,
      optimizeOnSubtract = true,
    } = opts;
    this._opts = { optimizeOnConstruct, optimizeOnAdd, optimizeOnSubtract };
    this._denominations = denominations;
    this._set(optimizeOnConstruct ? normalizeCoins(coins, this._denominations) : { ...coins });
  }

  /**
   * Internal setter used to assign fields directly.
   * @private
   * @param {CoinBag} param0
   */
  _set({ ouro = 0, prata = 0, cobre = 0 }) {
    this.ouro = ouro; this.prata = prata; this.cobre = cobre;
  }

  /**
   * Total value of the wallet in copper units.
   * @returns {number}
   */
  total() { return valueFromCoins(this, this._denominations); }

  /**
   * Adds either a numeric amount (treated as copper) or a CoinBag.
   * Behavior depends on optimize flags:
   *  - If `optimizeOnAdd` is true (default), converts to total and re-optimizes.
   *  - If false, preserves counts: numbers increase copper; objects add by key.
   * @param {number|CoinBag} arg Amount in copper or a coin bag.
   * @returns {Wallet} This wallet (chainable).
   * @throws {Error} If the value to add is invalid.
   * @example
   * wallet.add(328);                // add 328 copper
   * wallet.add({ prata: 3, cobre: 2 }); // add by denomination
   */
  add(arg) {
    const isNumber = typeof arg === "number";
    const delta = isNumber ? arg : valueFromCoins(arg, this._denominations);
    if (!isNonNegInt(delta)) throw new Error(`Invalid value to add: ${delta}`);

    if (this._opts.optimizeOnAdd) {
      this._set(makeChange(this.total() + delta, this._denominations));
    } else {
      if (isNumber) this.cobre += delta;
      else {
        this.ouro  += arg.ouro  ?? 0;
        this.prata += arg.prata ?? 0;
        this.cobre += arg.cobre ?? 0;
      }
    }
    return this;
  }

  /**
   * Subtracts either a numeric amount (copper) or a CoinBag.
   *  - If `optimizeOnSubtract` is true (default), subtracts by total and re-optimizes.
   *  - If false, spends by **breaking** larger coins down (gold→silver→copper)
   *    and never promotes smaller coins upward.
   * @param {number|CoinBag} arg Amount in copper or a coin bag.
   * @returns {Wallet} This wallet (chainable).
   * @throws {Error} If the value is invalid or funds are insufficient.
   * @example
   * wallet.subtract(615);
   */
  subtract(arg) {
    const delta = typeof arg === "number" ? arg : valueFromCoins(arg, this._denominations);
    if (!isNonNegInt(delta)) throw new Error(`Invalid value to subtract: ${delta}`);
    if (this.total() < delta) {
      throw new Error(`Insufficient funds: short by ${delta - this.total()} (copper).`);
    }

    if (this._opts.optimizeOnSubtract) {
      this._set(makeChange(this.total() - delta, this._denominations));
      return this;
    }

    // "Preserve" mode: spend from smallest denomination first, breaking larger denominations as needed
    let need = delta;

    // Get denomination values (use defaults if not provided)
    const denomValues = this._denominations && this._denominations.length >= 3 ? {
      ouro: this._denominations[0].value,
      prata: this._denominations[1].value,
      cobre: this._denominations[2].value
    } : {
      ouro: 80,
      prata: 4,
      cobre: 1
    };

    const spendFrom = (key, amt) => {
      const take = Math.min(this[key], amt);
      this[key] -= take;
      return take;
    };
    
    const breakPrata = () => {
      if (this.prata <= 0) return false;
      this.prata -= 1; 
      this.cobre += Math.floor(denomValues.prata / denomValues.cobre);
      return true;
    };
    
    const breakOuro = () => {
      if (this.ouro <= 0) return false;
      this.ouro -= 1; 
      this.prata += Math.floor(denomValues.ouro / denomValues.prata);
      return true;
    };

    while (need > 0) {
      const used = spendFrom("cobre", need);
      need -= used;
      if (need === 0) break;

      if (this.cobre === 0) {
        if (!breakPrata()) {
          if (!breakOuro()) throw new Error("Insufficient funds (unexpected).");
        }
      }
    }
    return this;
  }

  /**
   * Normalizes the current counts into the optimal combination (minimal coins).
   * @returns {Wallet} This wallet (chainable).
   */
  normalize() {
    this._set(normalizeCoins(this, this._denominations));
    return this;
  }

  /**
   * Returns a plain object snapshot of the wallet.
   * @returns {CoinBag}
   */
  toObject() { return { ouro: this.ouro, prata: this.prata, cobre: this.cobre }; }

  /**
   * Human-readable string with counts and total (copper).
   * @returns {string}
   */
  toString() {
    return `${this.ouro} ouro, ${this.prata} prata, ${this.cobre} cobre (total=${this.total()})`;
  }
}

/**
 * CurrencyManager - Handles character sheet currency operations
 */
class CurrencyManager {
  constructor(moduleId) {
    this.moduleId = moduleId;
  }

  /**
   * Formats a numeric amount as currency string
   * @param {number} amount - The amount to format
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount) {
    return '$' + Number(amount || 0).toLocaleString(undefined);
  }

  /**
   * Parses a currency-formatted string into a numeric value
   * @param {string|number} value - The currency string or number
   * @returns {number} Parsed numeric value
   */
  parseCurrency(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      return Number(value.replace(/[^0-9.-]+/g, '')) || 0;
    }
    return 0;
  }

  /**
   * Gets the wallet amount for a specific user
   * @param {string} userId - The user ID
   * @returns {number} The wallet amount
   */
  getUserWallet(userId) {
    console.log('💰 DEBUG getUserWallet - userId:', userId);
    
    // Check if module currency system is enabled
    const useModuleCurrency = game.settings.get(this.moduleId, 'useModuleCurrencySystem');
    console.log('💰 DEBUG getUserWallet - useModuleCurrency:', useModuleCurrency);
    
    if (!useModuleCurrency) {
      // Use character sheet currency system
      console.log('💰 DEBUG getUserWallet - Using character sheet currency system');
      return this._getCharacterSheetCurrency(userId);
    }
    
    console.log('💰 DEBUG getUserWallet - Using module currency system');
    const user = game.users.get(userId);
    return Number(user?.getFlag(this.moduleId, 'wallet')) || 0;
  }

  /**
   * Gets the wallet amount from character sheet currency items
   * @param {string} userId - The user ID
   * @returns {number} The total wallet amount from character sheet
   */
  _getCharacterSheetCurrency(userId) {
    const coinBreakdown = this._getCharacterSheetCoinBreakdown(userId);
    let totalValue = 0;
    for (const coin of coinBreakdown) {
      totalValue += coin.count * coin.value;
    }
    return totalValue;
  }

  /**
   * Gets the breakdown of currency coins from module wallet system
   * @param {string} userId - The user ID
   * @returns {Array<{name: string, count: number, value: number}>} Array of coin breakdown objects
   */
  getModuleCurrencyBreakdown(userId) {
    const totalValue = this.getUserWallet(userId);
    const denominations = game.settings.get(this.moduleId, 'currencyDenominations') || [];
    
    // Use currency.js makeChange function
    const coinBag = makeChange(totalValue, denominations);
    const breakdown = [];
    
    // Map the standard coin names to configured denomination names
    const coinMapping = {
      'ouro': denominations[0]?.name || 'Gold',
      'prata': denominations[1]?.name || 'Silver', 
      'cobre': denominations[2]?.name || 'Copper'
    };
    
    const coinValues = {
      'ouro': denominations[0]?.value || 80,
      'prata': denominations[1]?.value || 4,
      'cobre': denominations[2]?.value || 1
    };
    
    for (const [coinType, count] of Object.entries(coinBag)) {
      if (count > 0) {
        breakdown.push({
          name: coinMapping[coinType],
          count: count,
          value: coinValues[coinType]
        });
      }
    }
    
    return breakdown;
  }

  /**
   * Recursively flattens an object to extract all item-like objects.
   * Assumes an item-like object has at least a 'name' property.
   * @param {Object} obj - The object to flatten.
   * @returns {Array<Object>} An array of objects with id and data properties.
   */
  _flattenItemsFromObject(obj) {
    const items = [];
    if (typeof obj !== 'object' || obj === null) {
      return items;
    }
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          // Heuristic: if it has a 'name' property, consider it an item.
          if (value.name !== undefined) {
            items.push({ id: key, data: value });
          } else {
            // If not an item, recurse into the nested object
            items.push(...this._flattenItemsFromObject(value));
          }
        }
      }
    }
    return items;
  }

  /**
   * Gets the breakdown of currency coins from character sheet
   * @param {string} userId - The user ID
   * @returns {Array<{name: string, count: number, value: number, itemId: string}>} Array of coin breakdown objects with item IDs
   */
  _getCharacterSheetCoinBreakdown(userId) {
    console.log('💰 DEBUG _getCharacterSheetCurrency - userId:', userId);
    
    const user = game.users.get(userId);
    console.log('💰 DEBUG _getCharacterSheetCurrency - user:', user);
    
    // Buscar ator do usuário - primeiro tenta character, depois busca por ownership
    let actor = user?.character;
    
    if (!actor) {
      // Se não tem character assignado, busca por ownership
      const userActors = game.actors.filter(a => a.hasPlayerOwner && a.ownership[userId] >= 3);
      if (userActors.length > 0) {
        actor = userActors[0]; // Pega o primeiro ator com ownership
      }
    }
    
    if (!actor) {
      console.warn(`No character found for user ${user?.name || userId}`);
      return [];
    }
    
    console.log('💰 DEBUG _getCharacterSheetCurrency - actor:', actor.name, 'ID:', actor.id);
    
    const carried = actor.system?.equipment?.carried;
    console.log('💰 DEBUG _getCharacterSheetCurrency - carried:', carried);
    
    if (!carried) {
      console.warn(`No equipment.carried found for character ${actor.name}`);
      return [];
    }

    // Get currency denominations from settings
    const denominations = game.settings.get(this.moduleId, 'currencyDenominations') || [];
    console.log('💰 DEBUG _getCharacterSheetCurrency - denominations:', denominations);
    
    const coinBreakdown = [];

    // Convert carried object to array for easier processing
    const carriedItems = this._flattenItemsFromObject(carried);
    console.log('💰 DEBUG _getCharacterSheetCurrency - carriedItems count (flattened):', carriedItems.length);

    // For each denomination, find matching items in character sheet
    for (const denom of denominations) {
      console.log('💰 DEBUG _getCharacterSheetCurrency - Processing denomination:', denom.name, 'value:', denom.value);
      console.log(`💰 DEBUG: Looking for item with name "${denom.name}"`);
      
      const matchingItems = carriedItems.filter(entry => 
        {
          // Garante que entry.data.name é uma string e remove espaços em branco
          const itemName = String(entry.data.name || '').trim();
          // Garante que denom.name é uma string e remove espaços em branco
          const denomName = String(denom.name || '').trim();
          return itemName === denomName;
        }
      );
      console.log('💰 DEBUG _getCharacterSheetCurrency - matchingItems for', denom.name, ':', matchingItems);

      // Adiciona o item à lista se ele for encontrado, mesmo que a quantidade seja 0
      // Isso garante que o itemId esteja disponível para atualização posterior
      if (matchingItems.length > 0) {
        const entry = matchingItems[0]; // Pega o primeiro item correspondente
        const count = entry.data.count || 0; // Pega a contagem atual, padrão para 0
        const value = denom.value || 0; // Usa o valor da denominação configurada
        
        console.log('💰 DEBUG _getCharacterSheetCurrency - Item:', entry.data.name, 'count:', count, 'value per unit:', value, 'total value:', count * value);
        
        if (value > 0) { // Apenas se a denominação tiver um valor válido
          coinBreakdown.push({
            name: denom.name,
            count: count,
            value: value,
            itemId: entry.id // Adiciona o ID do item para atualizações futuras
          });
        }
      }
    }

    console.log('💰 DEBUG _getCharacterSheetCoinBreakdown - Final coinBreakdown:', coinBreakdown);
    return coinBreakdown;
  }

  /**
   * Sets the wallet amount for a specific user
   * @param {string} userId - The user ID
   * @param {number} amount - The amount to set (minimum 0)
   * @returns {Promise<any>} The result of the flag update
   */
  async setUserWallet(userId, amount) {
    // Check if module currency system is enabled
    const useModuleCurrency = game.settings.get(this.moduleId, 'useModuleCurrencySystem');
    if (!useModuleCurrency) {
      // Handle character sheet currency system
      return await this._setCharacterSheetCurrency(userId, amount);
    }
    
    const user = game.users.get(userId);
    const result = await user?.setFlag(this.moduleId, 'wallet', Math.max(0, amount));
    return result;
  }

  /**
   * Sets the wallet amount by updating character sheet currency items
   * @param {string} userId - The user ID
   * @param {number} newAmount - The new total amount to set
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async _setCharacterSheetCurrency(userId, newAmount) {
    console.log('💰 DEBUG _setCharacterSheetCurrency - userId:', userId, 'newAmount:', newAmount);
    
    const user = game.users.get(userId);
    if (!user) {
      console.error('User not found:', userId);
      return false;
    }

    // Get the user's actor
    let actor = user.character;
    if (!actor) {
      const userActors = game.actors.filter(a => a.hasPlayerOwner && a.ownership[userId] >= 3);
      if (userActors.length > 0) {
        actor = userActors[0];
      }
    }

    if (!actor) {
      console.error(`No character found for user ${user.name || userId}`);
      ui.notifications.error('No character found with proper permissions.');
      return false;
    }

    console.log('💰 DEBUG _setCharacterSheetCurrency - actor:', actor.name);

    // Get current coin breakdown from character sheet
    const currentCoinBreakdown = this._getCharacterSheetCoinBreakdown(userId);
    console.log('💰 DEBUG _setCharacterSheetCurrency - currentCoinBreakdown:', currentCoinBreakdown);

    if (currentCoinBreakdown.length === 0) {
      console.warn('No currency items found on character sheet');
      ui.notifications.warn('No currency items found on character sheet. Please add currency items first.');
      return false;
    }

    // Get currency denominations from settings
    const denominations = game.settings.get(this.moduleId, 'currencyDenominations') || [];
    if (denominations.length !== 3) {
      console.error('Currency system requires exactly 3 denominations');
      ui.notifications.error('Currency system requires exactly 3 denominations to be configured.');
      return false;
    }

    // Calculate current total value
    const currentTotal = currentCoinBreakdown.reduce((sum, coin) => sum + (coin.count * coin.value), 0);
    console.log('💰 DEBUG _setCharacterSheetCurrency - currentTotal:', currentTotal, 'newAmount:', newAmount);

    // Ensure we don't go below zero
    const finalAmount = Math.max(0, newAmount);
    
    if (finalAmount > currentTotal) {
      console.warn('Cannot increase currency through character sheet system - only debiting is supported');
      ui.notifications.warn('Cannot add currency through character sheet system. Use GM tools to add currency items directly.');
      return false;
    }

    try {
      // Map current coins to currency.js format (ouro, prata, cobre)
      const currentCoinBag = { ouro: 0, prata: 0, cobre: 0 };
      
      // Map denominations to currency.js coin types
      const coinTypeMapping = ['ouro', 'prata', 'cobre']; // Highest to lowest value
      
      for (let i = 0; i < Math.min(denominations.length, 3); i++) {
        const denom = denominations[i];
        const coinType = coinTypeMapping[i];
        const coinData = currentCoinBreakdown.find(coin => coin.name === denom.name);
        if (coinData) {
          currentCoinBag[coinType] = coinData.count;
        }
      }

      console.log('💰 DEBUG _setCharacterSheetCurrency - currentCoinBag:', currentCoinBag);

      // Get optimize settings
      const optimizeOnConstruct = game.settings.get(this.moduleId, 'optimizeOnConstruct');

      // Create wallet with current coins (don't optimize on construct to preserve exact counts)
      const wallet = new Wallet(currentCoinBag, { 
        optimizeOnConstruct: optimizeOnConstruct, 
        optimizeOnAdd: false, 
        optimizeOnSubtract: false 
      }, denominations);

      console.log('💰 DEBUG _setCharacterSheetCurrency - wallet created with total:', wallet.total());

      // Calculate the amount to subtract
      const amountToSubtract = currentTotal - finalAmount;
      console.log('💰 DEBUG _setCharacterSheetCurrency - amountToSubtract:', amountToSubtract);

      if (amountToSubtract > 0) {
        // Subtract the amount using currency.js logic
        wallet.subtract(amountToSubtract);
        console.log('💰 DEBUG _setCharacterSheetCurrency - after subtract, wallet total:', wallet.total());
      }

      // Get the new coin distribution
      const newCoinBag = wallet.toObject();
      console.log('💰 DEBUG _setCharacterSheetCurrency - newCoinBag:', newCoinBag);

      // Build new carried object with updated quantities
      const updateData = {};

      for (let i = 0; i < Math.min(denominations.length, 3); i++) {
        const denom = denominations[i];
        const coinType = coinTypeMapping[i];
        const newCount = newCoinBag[coinType] || 0;
        const currentCoinData = currentCoinBreakdown.find(coin => coin.name === denom.name);

        console.log(`💰 DEBUG _setCharacterSheetCurrency - Processing ${denom.name} (${coinType}): current=${currentCoinData?.count || 0}, new=${newCount}`);

        if (currentCoinData && currentCoinData.itemId) {
          if (newCount !== currentCoinData.count) {
            // Update the item count
            const currentItem = actor.system.equipment.carried[currentCoinData.itemId];
            updateData[`system.equipment.carried.${currentCoinData.itemId}.count`] = newCount;
            updateData[`system.equipment.carried.${currentCoinData.itemId}.costsum`] = newCount * (currentItem.cost || 0);
            updateData[`system.equipment.carried.${currentCoinData.itemId}.weightsum`] = newCount * (currentItem.weight || 0);
            console.log(`💰 DEBUG _setCharacterSheetCurrency - Marking ${denom.name} for update: ${currentCoinData.count} -> ${newCount}`);
          }
        } else if (newCount > 0) {
          // We need to create a new item, but we can't without a UUID
          console.warn(`💰 WARNING: Need to create ${newCount} ${denom.name} but no existing item found to copy from`);
          ui.notifications.warn(`Cannot create ${denom.name} items. Please add at least one ${denom.name} to your character sheet first.`);
          return false;
        }
      }

      // Apply all changes using granular updates
      if (Object.keys(updateData).length > 0) {
        console.log('💰 DEBUG _setCharacterSheetCurrency - Applying granular updates:', updateData);
        await actor.update(updateData);
      } else {
        console.log('💰 DEBUG _setCharacterSheetCurrency - No changes needed');
      }

      // Force a re-render of any open character sheets
      if (actor.sheet && actor.sheet.rendered) {
        console.log('💰 DEBUG _setCharacterSheetCurrency - Refreshing character sheet');
        actor.sheet.render(false);
      }

      // Refresh all open wallet applications to show updated balance
      this._refreshWalletApplications();

      console.log('💰 DEBUG _setCharacterSheetCurrency - Currency update completed successfully');
      return true;

    } catch (error) {
      console.error('💰 ERROR _setCharacterSheetCurrency:', error);
      ui.notifications.error(`Failed to update character currency: ${error.message}`);
      return false;
    }
  }

  /**
   * Refreshes all open wallet applications to show updated balance
   * @private
   */
  _refreshWalletApplications() {
    console.log('💰 DEBUG _refreshWalletApplications - Refreshing wallet applications');
    
    // Refresh all open wallet-related windows
    Object.values(ui.windows).forEach(window => {
      if (window instanceof PlayerWalletApplication || 
          window instanceof VendorDisplayApplication ||
          window instanceof MoneyManagementApplication) {
        console.log('💰 DEBUG _refreshWalletApplications - Refreshing window:', window.constructor.name);
        window.render(false);
      }
    });
  }

  /**
   * Processes an item purchase transaction
   * @param {Actor} actor - The purchasing actor
   * @param {Item} item - The item to purchase
   * @param {string} vendorId - The vendor ID
   * @param {string} vendorItemId - The vendor item ID
   * @param {number} [quantity=1] - Quantity being purchased
   * @returns {Promise<boolean>} True if purchase was successful
   */
  async processItemPurchase(actor, item, vendorId, vendorItemId, quantity = 1) {
    const userId = game.user.id;
    const currentWallet = this.getUserWallet(userId);
    // REMOVIDO: Math.round() desnecessário - valores devem ser tratados como inteiros desde a origem
    const itemPrice = parseInt(item.system?.eqt?.cost || item.system?.cost || 0);

    // Verify vendor stock if available
    if (vendorId && vendorItemId) {
      const vendor = this.getVendor(vendorId);
      const vendorItem = vendor?.items.find(i => i.id === vendorItemId);
      const stock = vendorItem?.quantity;
      if (stock !== undefined && stock < quantity) {
        ui.notifications.warn(`${item.name} is out of stock.`);
        return false;
      }
    }

    const totalPrice = itemPrice * quantity;
    const roundedTotalPrice = Math.ceil(totalPrice);

    if (currentWallet >= roundedTotalPrice) {
      // Debit money from wallet
      await this.setUserWallet(userId, currentWallet - roundedTotalPrice);
      // Add item to actor, updating quantity if it already exists
      const sourceId =
        item._stats?.compendiumSource ||
        item.flags?.core?.sourceId ||
        item.system?.globalid;
      let actorItem = sourceId
        ? actor.items.find(i =>
            i._stats?.compendiumSource === sourceId ||
            i.flags?.core?.sourceId === sourceId ||
            i.system?.globalid === sourceId
          )
        : null;

      if (actorItem) {
        // Determine which quantity path to use
        const isEquipment = actorItem.system?.eqt?.count !== undefined;
        const path = isEquipment ? "system.eqt.count" : "system.quantity";
        const total = (getProperty(actorItem, path) ?? 0) + quantity;

        // Update using system-specific method
        if (isEquipment) {
          const key = actor._findEqtkeyForId("itemid", actorItem.id);

          if (!key || typeof actor.updateEqtCount !== "function") {
            await actorItem.update({ [path]: total });
          } else {
            await actor.updateEqtCount(key, total);
          }
        } else {
          await actorItem.update({ [path]: total });
        }
      } else {
        // Create the item with initial quantity
        const itemData = item.toObject();
        delete itemData._id; // Ensure new _id is generated
        itemData._stats ??= {};
        itemData._stats.compendiumSource = sourceId;
        if (itemData.system?.eqt?.count !== undefined) itemData.system.eqt.count = quantity;
        else itemData.system.quantity = quantity;

        await actor.createEmbeddedDocuments('Item', [itemData]);
      }

      // Remove item from vendor
      if (vendorId && vendorItemId) {
        await this.updateItemQuantityInVendor(vendorId, vendorItemId, -quantity);
      }

      ui.notifications.info(`${quantity}x ${item.name} purchased for ${this.formatCurrency(roundedTotalPrice)} and added to ${actor.name}'s inventory.`);
      return true;
    } else {
      ui.notifications.warn(`Not enough coins to purchase ${quantity}x ${item.name}. Need ${this.formatCurrency(roundedTotalPrice)} but only have ${this.formatCurrency(currentWallet)}.`);
      return false;
    }
  }

  /**
   * Gets a specific vendor by ID
   * @param {string} vendorId - The vendor ID
   * @returns {Object|undefined} The vendor data
   */
  getVendor(vendorId) {
    try {
      const vendors = game.settings.get(this.moduleId, 'vendors');
      return vendors[vendorId];
    } catch (err) {
      console.warn('Setting gurps-instant-bazaar.vendors ausente', err);
      return undefined;
    }
  }

  /**
   * Updates the quantity of an item in a vendor's inventory
   * @param {string} vendorId - The vendor ID
   * @param {string} vendorItemId - The vendor item ID
   * @param {number} change - The quantity change (positive or negative)
   * @returns {Promise<void>}
   */
  async updateItemQuantityInVendor(vendorId, vendorItemId, change) {
    const vendor = this.getVendor(vendorId);
    if (!vendor) return;

    // Find the item and update its quantity
    const itemIndex = vendor.items.findIndex(item => item.id === vendorItemId);
    
    if (itemIndex === -1) {
      return;
    }
    
    const item = vendor.items[itemIndex];
    const currentQuantity = item.quantity || 1;
    const newQuantity = Math.max(0, currentQuantity + change);
    
    if (newQuantity <= 0) {
      // Remove item completely if quantity reaches 0
      vendor.items = vendor.items.filter(item => item.id !== vendorItemId);
    } else {
      // Update the quantity
      vendor.items[itemIndex].quantity = newQuantity;
    }

    // Update the vendor
    try {
      const vendors = game.settings.get(this.moduleId, 'vendors');
      vendors[vendorId] = vendor;
      await game.settings.set(this.moduleId, 'vendors', vendors);
      
      // Notify all clients about the item purchase
      game.socket.emit(`module.${this.moduleId}`, {
        type: 'itemPurchased',
        vendorId: vendorId,
        itemId: vendorItemId
      });
    } catch (err) {
      console.error('Error updating vendor:', err);
    }
  }
}

// Also expose to global scope for FoundryVTT modules
if (typeof window !== 'undefined') {
  window.Wallet = Wallet;
  window.valueFromCoins = valueFromCoins;
  window.makeChange = makeChange;
  window.normalizeCoins = normalizeCoins;
  window.isNonNegInt = isNonNegInt;
  window.CurrencyManager = CurrencyManager;
}