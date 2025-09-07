/**
 * @file Utility functions and classes for managing currency and wallets
 */

import { flattenItemsFromObject } from './utils.js';

const isNonNegInt = (n) => Number.isInteger(n) && n >= 0;

function _calculateBaseUnitMultiplier(denominations) {
  if (!denominations || denominations.length === 0) return 1;
  let maxDecimalPlaces = 0;
  for (const denom of denominations) {
    const valueStr = denom.value.toString();
    const decimalIndex = valueStr.indexOf(".");
    if (decimalIndex !== -1) {
      const decimalPlaces = valueStr.length - decimalIndex - 1;
      maxDecimalPlaces = Math.max(maxDecimalPlaces, decimalPlaces);
    }
  }
  return Math.pow(10, maxDecimalPlaces);
}

export function valueFromCoins(coins = {}, denominations = null) {
  if (!denominations || !Array.isArray(denominations)) {
    throw new Error("Denominations array is required");
  }
  let totalValue = 0;
  for (const [coinName, count] of Object.entries(coins)) {
    if (!isNonNegInt(count)) {
      throw new Error(`Invalid quantity for ${coinName}: ${count}`);
    }
    const denomination = denominations.find((d) => d.name === coinName);
    if (denomination) {
      totalValue += count * denomination.value;
    }
  }
  return totalValue;
}

export function makeChange(total, denominations = null) {
  if (!isNonNegInt(total)) throw new Error(`Invalid total: ${total}`);
  if (!denominations || !Array.isArray(denominations)) {
    throw new Error("Denominations array is required");
  }
  const denoms = [...denominations].sort((a, b) => b.value - a.value);
  const out = {};
  let rest = total;
  for (const denomination of denoms) {
    const count = Math.floor(rest / denomination.value);
    out[denomination.name] = count;
    rest = rest % denomination.value;
  }
  return out;
}

export function normalizeCoins(coins, denominations = null) {
  return makeChange(valueFromCoins(coins, denominations), denominations);
}

export class Wallet {
  constructor(coins = {}, opts = {}, denominations = null) {
    const {
      optimizeOnConstruct = true,
      optimizeOnAdd = true,
      optimizeOnSubtract = false, // if true: canonical path (largest→smallest) after subtracting
      spendSmallestFirst = true,  // spend starting from the smallest
      repackAfterSubtract = "up"  // "none" | "up" (coalesce upward after paying)
    } = opts;

    this._denominations = (denominations || [])
      .slice()
      .sort((a, b) => b.value - a.value);

    this._opts = {
      optimizeOnConstruct,
      optimizeOnAdd,
      optimizeOnSubtract,
      spendSmallestFirst,
      repackAfterSubtract
    };

    this._baseUnitMultiplier = _calculateBaseUnitMultiplier(this._denominations);
    this._assertCanonical();

    const scaled = this._getScaledDenominations();
    this._coins = optimizeOnConstruct ? normalizeCoins(coins, scaled) : { ...coins };
  }

  _assertCanonical() {
    const d = this._getScaledDenominations();
    for (let i = 0; i < d.length - 1; i++) {
      const a = d[i].value, b = d[i + 1].value;
      if (a % b !== 0) {
        throw new Error(
          `Non-canonical denominations after scaling: ${d[i].name} (${a}) is not a multiple of ${d[i + 1].name} (${b}).`
        );
      }
    }
  }

  _getScaledValue(val) { return Math.round(val * this._baseUnitMultiplier); }
  _getUnscaledValue(val) { return val / this._baseUnitMultiplier; }

  _getScaledDenominations() {
    return this._denominations
      .map((denom) => ({ ...denom, value: this._getScaledValue(denom.value) }))
      .sort((a, b) => b.value - a.value);
  }

  _set(coinBag) { this._coins = { ...coinBag }; }

  total() {
    return valueFromCoins(this._coins, this._getScaledDenominations());
  }

  _coalesceUp(bag) {
    const d = this._getScaledDenominations();
    const out = { ...bag };
    for (let i = d.length - 1; i > 0; i--) {
      const lower = d[i], higher = d[i - 1];
      const ratio = Math.floor(higher.value / lower.value);
      if (ratio <= 1) continue;
      const have = out[lower.name] | 0;
      if (have >= ratio) {
        const promote = Math.floor(have / ratio);
        out[lower.name] = have - promote * ratio;
        out[higher.name] = (out[higher.name] | 0) + promote;
      }
    }
    return out;
  }

  _breakOne(bag, idx) {
    const d = this._getScaledDenominations();
    if (idx >= d.length - 1) return false;
    const from = d[idx], to = d[idx + 1];
    const cnt = bag[from.name] | 0;
    if (cnt <= 0) return false;
    const ratio = from.value / to.value;
      if (!Number.isInteger(ratio)) {
        throw new Error("Denominations do not allow a clean break (non-integers after scaling).");
      }
    bag[from.name] = cnt - 1;
    bag[to.name] = (bag[to.name] | 0) + ratio;
    return true;
  }

  /**
   * Adiciona valores ao conteúdo da carteira.
   *
   * @param {number|Object<string,number>} [arg=0] - Quantia a ser somada. Pode ser
   * um número (em unidades base) ou um objeto mapeando nomes de moedas para
   * quantidades.
   * @returns {Wallet} Esta própria carteira, para encadeamento.
   * @throws {Error} Se o valor informado for negativo ou não inteiro após o
   *   escalonamento.
   *
   * @example
   * const wallet = new Wallet();
   * wallet.add({ prata: 3 });
   *
   * @see Wallet#subtract
   */
  add(arg) {
    const D = this._getScaledDenominations();
    const isNumber = typeof arg === "number";
    const delta = isNumber ? this._getScaledValue(arg) : valueFromCoins(arg, D);
    if (!isNonNegInt(delta)) throw new Error(`Invalid value to add: ${delta}`);

    if (this._opts.optimizeOnAdd) {
      this._addOptimized(delta, D);
    } else {
      this._addNonOptimized(arg, delta, isNumber, D);
    }
    return this;
  }

  /**
   * Handles optimized addition by converting to optimal coin distribution
   * @param {number} delta - The scaled amount to add
   * @param {Array} denominations - The scaled denominations
   * @private
   */
  _addOptimized(delta, denominations) {
    this._set(makeChange(this.total() + delta, denominations));
  }

  /**
   * Handles non-optimized addition by adding coins directly
   * @param {number|Object} arg - Original argument passed to add()
   * @param {number} delta - The scaled amount to add
   * @param {boolean} isNumber - Whether arg is a number
   * @param {Array} denominations - The scaled denominations
   * @private
   */
  _addNonOptimized(arg, delta, isNumber, denominations) {
    if (isNumber) {
      if (denominations.length > 0) {
        const smallest = denominations[denominations.length - 1];
        const unit = smallest.value;
        const whole = Math.floor(delta / unit);
        const rem = delta % unit;
        this._coins[smallest.name] = (this._coins[smallest.name] || 0) + whole;
        if (rem) {
          const tmp = makeChange(this.total() + rem, denominations);
          this._set(tmp);
        }
      }
    } else {
      for (const [denomName, count] of Object.entries(arg)) {
        this._coins[denomName] = (this._coins[denomName] || 0) + count;
      }
    }
  }

  /**
   * Subtrai valores do conteúdo da carteira.
   *
   * @param {number|Object<string,number>} [arg=0] - Quantia a ser removida. Pode
   * ser um número (em unidades base) ou um objeto mapeando moedas para
   * quantidades.
   * @returns {Wallet} Esta própria carteira, para encadeamento.
   * @throws {Error} Se o valor for negativo, não inteiro ou se houver fundos
   *   insuficientes. Também lança erro caso seja necessário quebrar moedas
   *   maiores quando `spendSmallestFirst` está desativado.
   *
   * @see Wallet#add
   */
  subtract(arg) {
    const D = this._getScaledDenominations();
    const delta = typeof arg === "number" ? this._getScaledValue(arg) : valueFromCoins(arg, D);
    if (!isNonNegInt(delta)) throw new Error(`Invalid value to subtract: ${delta}`);
    const tot = this.total();
    if (tot < delta) throw new Error(`Insufficient funds: short by ${delta - tot} (base units).`);

    if (this._opts.optimizeOnSubtract) {
      this._subtractOptimized(tot, delta, D);
    } else {
      this._subtractNonOptimized(delta, D);
    }
    return this;
  }

  /**
   * Handles optimized subtraction by converting to optimal coin distribution
   * @param {number} total - Current wallet total
   * @param {number} delta - The scaled amount to subtract
   * @param {Array} denominations - The scaled denominations
   * @private
   */
  _subtractOptimized(total, delta, denominations) {
    this._set(makeChange(total - delta, denominations));
  }

  /**
   * Handles non-optimized subtraction with coin breaking logic
   * @param {number} delta - The scaled amount to subtract
   * @param {Array} denominations - The scaled denominations
   * @private
   */
  _subtractNonOptimized(delta, denominations) {
    const work = { ...this._coins };
    let remaining = delta;

    if (this._opts.spendSmallestFirst) {
      remaining = this._subtractSmallestFirst(remaining, denominations, work);
    } else {
      remaining = this._subtractLargestFirst(remaining, denominations, work);
    }

    const result = this._opts.repackAfterSubtract === "up" ? this._coalesceUp(work) : work;
    this._set(result);
  }

  /**
   * Subtracts coins starting from smallest denomination with coin breaking
   * @param {number} remaining - Amount still to subtract
   * @param {Array} denominations - The scaled denominations
   * @param {Object} work - Working copy of coins
   * @returns {number} Remaining amount after subtraction
   * @private
   */
  _subtractSmallestFirst(remaining, denominations, work) {
    while (remaining > 0) {
      let spentThisPass = 0;

      // menor → maior
      for (let i = denominations.length - 1; i >= 0 && remaining > 0; i--) {
        const name = denominations[i].name, v = denominations[i].value;
        const have = work[name] | 0;
        const take = Math.min(have, Math.floor(remaining / v));
        if (take > 0) {
          work[name] = have - take;
          remaining -= take * v;
          spentThisPass += take * v;
        }
      }

      if (remaining === 0) break;

      if (spentThisPass === 0) {
        let broke = false;
        for (let i = denominations.length - 2; i >= 0; i--) {
          if (this._breakOne(work, i)) { broke = true; break; }
        }
        if (!broke) throw new Error("Insufficient funds (unexpected).");
      }
    }
    return remaining;
  }

  /**
   * Subtracts coins starting from largest denomination without coin breaking
   * @param {number} remaining - Amount still to subtract
   * @param {Array} denominations - The scaled denominations
   * @param {Object} work - Working copy of coins
   * @returns {number} Remaining amount after subtraction
   * @private
   */
  _subtractLargestFirst(remaining, denominations, work) {
    // maior → menor (sem normalizar tudo)
    for (let i = 0; i < denominations.length && remaining > 0; i++) {
      const name = denominations[i].name, v = denominations[i].value;
      const have = work[name] | 0;
      const take = Math.min(have, Math.floor(remaining / v));
      if (take > 0) {
        work[name] = have - take;
        remaining -= take * v;
      }
    }
    if (remaining > 0) {
      throw new Error("Need to break higher coins; enable spendSmallestFirst.");
    }
    return remaining;
  }

  normalize() {
    this._set(normalizeCoins(this._coins, this._getScaledDenominations()));
    return this;
  }

  toObject() { return { ...this._coins }; }

  toString() {
    const coinStrings = [];
    for (const denom of this._denominations) {
      const count = this._coins[denom.name] || 0;
      if (count > 0) coinStrings.push(`${count} ${denom.name}`);
    }
    return `${coinStrings.join(", ")} (total=${this._getUnscaledValue(this.total())})`;
  }
}

/**
 * Creates a complete GURPS currency item with all required properties
 * @param {Object} denomination - The currency denomination configuration
 * @param {number} count - The initial count for this currency
 * @returns {Object} Complete GURPS currency item object
 */
function createCompleteGURPSCoinItem(denomination, count = 0) {
  const currentDate = new Date().toISOString();
  const uuid = foundry.utils.randomID(16);
  const itemId = foundry.utils.randomID(16);
  
  return {
    name: denomination.name,
    notes: "",
    pageref: denomination.pageref || "B264",
    count: count,
    weight: denomination.weight || 0,
    cost: denomination.value,
    location: "",
    carried: true,
    equipped: true,
    techlevel: denomination.techlevel || "1",
    categories: denomination.categories || "",
    legalityclass: denomination.legalityclass || "",
    costsum: parseFloat((count * denomination.value).toFixed(2)),
    weightsum: parseFloat((count * (denomination.weight || 0)).toFixed(3)),
    uses: null,
    maxuses: 0,
    parentuuid: "",
    uuid: uuid,
    contains: {},
    originalName: denomination.name,
    originalCount: "",
    ignoreImportQty: false,
    last_import: currentDate,
    save: true,
    itemid: itemId,
    img: denomination.img || "icons/svg/item-bag.svg"
  };
}

/**
 * Integrates wallets with Foundry actors and settings.
 * @class CurrencyManager
 */
export default class CurrencyManager {
  /**
   * @param {string} moduleId - Module identifier used for settings keys
   */
  constructor(moduleId) {
    this.moduleId = moduleId;
    const denominations = game.settings.get(this.moduleId, "currencyDenominations") || [];
      this._baseUnitMultiplier = _calculateBaseUnitMultiplier(denominations);
      this._moduleScale = 100; // cents in module mode (no physical coins)
  }

  _getScale() {
    const useModuleCurrency = game.settings.get(this.moduleId, "useModuleCurrencySystem");
    return useModuleCurrency ? this._moduleScale : this._baseUnitMultiplier;
  }

  formatCurrency(amount) {
    const currencySymbol = game.settings.get(this.moduleId, "currencySymbol") || "$";

    // Ensure we have a valid number
    let finalAmount = Number(amount);
    if (!Number.isFinite(finalAmount)) {
      finalAmount = 0;
    }

    // Ensure minimum value for display purposes
    if (finalAmount > 0 && finalAmount < 0.01) finalAmount = 0.01;
    
    // Round to 2 decimal places
    finalAmount = Math.round(finalAmount * 100) / 100;
    
    // Format with American standard (1,000.00) and configurable symbol
    const formattedNumber = finalAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `${currencySymbol}${formattedNumber}`;
  }

  parseCurrency(value) {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return 0;
    let s = value.trim();
    s = s.replace(/\s/g, "");
    s = s.replace(/[^\d.,\-]/g, "");
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    let decSep = ".";
    if (lastComma > lastDot) decSep = ",";
    const thouSep = decSep === "." ? "," : ".";
    const reThou = new RegExp("\\" + thouSep, "g");
    s = s.replace(reThou, "");
    if (decSep === ",") s = s.replace(/,/g, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  getUserWallet(userId) {
    const useModuleCurrency = game.settings.get(this.moduleId, "useModuleCurrencySystem");
    if (!useModuleCurrency) {
      return this._getCharacterSheetCurrency(userId);
    }
    const user = game.users.get(userId);
    const scale = this._getScale();
    const scaledAmount = Number(user?.getFlag(this.moduleId, "wallet")) || 0;
    return scaledAmount / scale;
  }

  async setUserWallet(userId, amount) {
    const useModuleCurrency = game.settings.get(this.moduleId, "useModuleCurrencySystem");
    if (!useModuleCurrency) {
      return await this._setCharacterSheetCurrency(userId, amount);
    }
    const user = game.users.get(userId);
    const scale = this._getScale();
    const scaledAmount = Math.max(0, Math.round((Number(amount) || 0) * scale));
    const result = await user?.setFlag(this.moduleId, "wallet", scaledAmount);
    return result;
  }

  _getCharacterSheetCurrency(userId) {
    const coinBreakdown = this._getCharacterSheetCoinBreakdown(userId);
    let totalValue = 0;
    for (const coin of coinBreakdown) {
      totalValue += coin.count * coin.value;
    }
    return totalValue;
  }

  getModuleCurrencyBreakdown(userId) {
    const unscaledTotalValue = this.getUserWallet(userId);
const scaledTotalValue = Math.round(unscaledTotalValue * this._getScale());
    const denominations = (game.settings.get(this.moduleId, "currencyDenominations") || [])
      .slice()
      .sort((a, b) => b.value - a.value);

    if (denominations.length === 0) return [];

    const scaledDenominations = denominations.map((denom) => ({
      ...denom,
      value: denom.value * this._getScale()
    }));

    const coinBag = makeChange(scaledTotalValue, scaledDenominations);
    const breakdown = [];
    for (const denomination of denominations) {
      const count = coinBag[denomination.name] || 0;
      if (count > 0) {
        breakdown.push({
          name: denomination.name,
          count: count,
          value: denomination.value
        });
      }
    }
    return breakdown;
  }

  _getCharacterSheetCoinBreakdown(userId) {
    const user = game.users.get(userId);
    let actor = user?.character;

    if (!actor) {
      const userActors = game.actors.filter(
        (a) => a.hasPlayerOwner && a.ownership[userId] >= 3
      );
      if (userActors.length > 0) actor = userActors[0];
    }
    if (!actor) return [];

    const carried = actor.system?.equipment?.carried;
    if (!carried) return [];

    const denominations = game.settings.get(this.moduleId, "currencyDenominations") || [];
    const coinBreakdown = [];

    // Get all items from the carried equipment
    const carriedItems = flattenItemsFromObject(carried);
    
    // Find coin items that match our denominations
    for (const denomination of denominations) {
      const coinItem = carriedItems.find(item => 
        item.data.name === denomination.name
      );
      
      if (coinItem) {
        const count = coinItem.data.count || 0;
        if (count > 0) {
          coinBreakdown.push({
            name: denomination.name,
            count: count,
            value: denomination.value,
            itemId: coinItem.id
          });
        }
      }
    }
    
    return coinBreakdown;
  }

  async _setCharacterSheetCurrency(userId, newAmount) {
    const scaledNewAmount = Math.round((Number(newAmount) || 0) * this._baseUnitMultiplier);

    const user = game.users.get(userId);
    if (!user) return false;

    let actor = user.character;
    if (!actor) {
      const userActors = game.actors.filter(
        (a) => a.hasPlayerOwner && a.ownership[userId] >= 3
      );
      if (userActors.length > 0) actor = userActors[0];
    }
    if (!actor) return false;

    const currentCoinBreakdown = this._getCharacterSheetCoinBreakdown(userId);

    const denominations = (game.settings.get(this.moduleId, "currencyDenominations") || [])
      .slice()
      .sort((a, b) => b.value - a.value);
    if (denominations.length === 0) return false;

    const finalScaledAmount = Math.max(0, scaledNewAmount);

    try {
      // Calculate the desired coin distribution for the final amount
      const scaledDenominations = denominations.map((denom) => ({
        ...denom,
        value: Math.round(denom.value * this._baseUnitMultiplier)
      }));
      
      const newCoinBag = makeChange(finalScaledAmount, scaledDenominations);
      const updateData = {};
      const itemsToDelete = [];
      const itemsToCreate = [];

      for (const denomination of denominations) {
        const newCount = newCoinBag[denomination.name] || 0;
        const currentCoinData = currentCoinBreakdown.find((coin) => coin.name === denomination.name);

        if (currentCoinData && currentCoinData.itemId) {
          // Update existing coin item
          if (newCount !== currentCoinData.count) {
            if (newCount === 0) {
              // Remove the item if count is 0
              itemsToDelete.push(currentCoinData.itemId);
            } else {
              // Update the item count and related sums
              const cost = denomination.value;
              const weight = denomination.weight || 0;
              updateData[`system.equipment.carried.${currentCoinData.itemId}.count`] = newCount;
              updateData[`system.equipment.carried.${currentCoinData.itemId}.weight`] = weight;
              updateData[`system.equipment.carried.${currentCoinData.itemId}.cost`] = cost;
              updateData[`system.equipment.carried.${currentCoinData.itemId}.costsum`] = parseFloat((newCount * cost).toFixed(2));
              updateData[`system.equipment.carried.${currentCoinData.itemId}.weightsum`] = parseFloat((newCount * weight).toFixed(3));
            }
          }
        } else if (newCount > 0) {
          // Create new complete coin item
          const newCoinId = foundry.utils.randomID(16);
          const completeCoinData = createCompleteGURPSCoinItem(denomination, newCount);
          updateData[`system.equipment.carried.${newCoinId}`] = completeCoinData;
        }
      }

      // Apply all changes
      if (Object.keys(updateData).length > 0) {
        await actor.update(updateData);
      }

      if (itemsToDelete.length > 0) {
        // Remove items from carried equipment by setting them to null
        const deleteData = {};
        for (const itemId of itemsToDelete) {
          deleteData[`system.equipment.carried.-=${itemId}`] = null;
        }
        if (Object.keys(deleteData).length > 0) {
          await actor.update(deleteData);
        }
      }

      if (actor.sheet && actor.sheet.rendered) actor.sheet.render(false);
      this._refreshWalletApplications();
      return true;
    } catch (error) {
      console.error("Error updating character sheet currency:", error);
      return false;
    }
  }

  /**
   * Refreshes any open wallet-related applications
   * @returns {void}
   */
  _refreshWalletApplications() {
    // Import these at the top of the file instead of accessing via window
    Object.values(ui.windows).forEach((app) => {
      if (
        app.constructor.name === 'PlayerWalletApplication' ||
        app.constructor.name === 'VendorDisplayApplication' ||
        app.constructor.name === 'MoneyManagementApplication'
      ) {
        app.render(false);
      }
    });
  }

  async processItemPurchase(actor, item, vendorId, vendorItemId, quantity = 1) {
    const userId = game.user.id;
    const currentWallet = this.getUserWallet(userId);
    const itemPrice = parseFloat(item.system?.eqt?.cost || item.system?.cost || 0);

    if (vendorId && vendorItemId) {
      const vendor = this.getVendor(vendorId);
      const vendorItem = vendor?.items.find((i) => i.id === vendorItemId);
      const stock = vendorItem?.quantity;
      if (stock !== undefined && stock < quantity) {
        return false;
      }
    }

    const totalPrice = itemPrice * quantity;

    if (currentWallet >= totalPrice) {
      await this.setUserWallet(userId, currentWallet - totalPrice);
      const sourceId =
        item._stats?.compendiumSource ||
        item.flags?.core?.sourceId ||
        item.system?.globalid;

      let actorItem = sourceId
        ? actor.items.find(
            (i) =>
              i._stats?.compendiumSource === sourceId ||
              i.flags?.core?.sourceId === sourceId ||
              i.system?.globalid === sourceId
          )
        : null;

      if (actorItem) {
        const isEquipment = actorItem.system?.eqt?.count !== undefined;
        const path = isEquipment ? "system.eqt.count" : "system.quantity";
        const total = (getProperty(actorItem, path) ?? 0) + quantity;

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
        const itemData = item.toObject();
        delete itemData._id;
        itemData._stats ??= {};
        itemData._stats.compendiumSource = sourceId;
        if (itemData.system?.eqt?.count !== undefined) itemData.system.eqt.count = quantity;
        else itemData.system.quantity = quantity;

        await actor.createEmbeddedDocuments("Item", [itemData]);
      }

      if (vendorId && vendorItemId) {
        await this.updateItemQuantityInVendor(vendorId, vendorItemId, -quantity);
      }

      return true;
    } else {
      return false;
    }
  }

  getVendor(vendorId) {
    try {
      const vendors = game.settings.get(this.moduleId, "vendors");
      return vendors[vendorId];
    } catch (err) {
      return undefined;
    }
  }

  async updateItemQuantityInVendor(vendorId, vendorItemId, change) {
    const vendor = this.getVendor(vendorId);
    if (!vendor) return;

    const itemIndex = vendor.items.findIndex((it) => it.id === vendorItemId);
    if (itemIndex === -1) return;

    const item = vendor.items[itemIndex];
    const currentQuantity = item.quantity || 1;
    const newQuantity = Math.max(0, currentQuantity + change);

    if (newQuantity <= 0) {
      vendor.items = vendor.items.filter((it) => it.id !== vendorItemId);
    } else {
      vendor.items[itemIndex].quantity = newQuantity;
    }

    try {
      const vendors = game.settings.get(this.moduleId, "vendors");
      vendors[vendorId] = vendor;
      await game.settings.set(this.moduleId, "vendors", vendors);

      game.socket.emit(`module.${this.moduleId}`, {
        type: "itemPurchased",
        vendorId: vendorId,
        itemId: vendorItemId
      });
      } catch (err) {
        // silent
      }
  }

  refreshSettings() {
    const denominations = game.settings.get(this.moduleId, "currencyDenominations") || [];
    this._baseUnitMultiplier = _calculateBaseUnitMultiplier(denominations);
  }

  /**
   * Initializes missing currency denominations for all actors without affecting existing coins
   * @returns {Promise<void>}
   */
  async initializeMissingActorCoins() {
    const denominations = game.settings.get(this.moduleId, "currencyDenominations") || [];
    
    if (denominations.length === 0) {
      ui.notifications.warn('No currency denominations configured. Please configure currency settings first.');
      return;
    }

    let processedActors = 0;
    let totalCoinsAdded = 0;

    // Iterate through all actors in the game
    for (const actor of game.actors.contents) {
      // Only process character-type actors that the GM has owner permission for
      if (actor.type !== 'character' || !actor.isOwner) {
        continue;
      }

      const carried = actor.system?.equipment?.carried;
      if (!carried) {
        console.warn(`Actor ${actor.name} has no carried equipment structure`);
        continue;
      }

      // Get all items from the carried equipment to check existing coins
      const carriedItems = flattenItemsFromObject(carried);
      let actorCoinsAdded = 0;
      const updateData = {};

      // Process each denomination for this actor
      for (const denomination of denominations) {
        // Check if the actor already has this coin in carried equipment
        const existingCoin = carriedItems.find(item => item.data.name === denomination.name);

        if (existingCoin) {
          // Skip if coin already exists - don't modify existing coins
          continue;
        } else {
          // Create new complete coin in carried equipment with quantity 0
          const newCoinId = foundry.utils.randomID(16);
          const completeCoinData = createCompleteGURPSCoinItem(denomination, 0);

          updateData[`system.equipment.carried.${newCoinId}`] = completeCoinData;
          actorCoinsAdded++;
        }
      }

      // Apply all coin additions for this actor at once
      if (Object.keys(updateData).length > 0) {
        await actor.update(updateData);
        processedActors++;
        totalCoinsAdded += actorCoinsAdded;
      }
    }

    // Refresh any open wallet applications
    this._refreshWalletApplications();

    console.log(`Initialized missing coins for ${processedActors} actors, added ${totalCoinsAdded} new coin items total.`);
  }
}
export { isNonNegInt };