/**
 * @file Utility functions and classes for managing currency and wallets
 */

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

function valueFromCoins(coins = {}, denominations = null) {
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

function makeChange(total, denominations = null) {
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

function normalizeCoins(coins, denominations = null) {
  return makeChange(valueFromCoins(coins, denominations), denominations);
}

class Wallet {
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

  add(arg) {
    const D = this._getScaledDenominations();
    const isNumber = typeof arg === "number";
    const delta = isNumber ? this._getScaledValue(arg) : valueFromCoins(arg, D);
    if (!isNonNegInt(delta)) throw new Error(`Invalid value to add: ${delta}`);

    if (this._opts.optimizeOnAdd) {
      this._set(makeChange(this.total() + delta, D));
    } else {
      if (isNumber) {
        if (D.length > 0) {
          const smallest = D[D.length - 1];
          const unit = smallest.value;
          const whole = Math.floor(delta / unit);
          const rem = delta % unit;
          this._coins[smallest.name] = (this._coins[smallest.name] || 0) + whole;
          if (rem) {
            const tmp = makeChange(this.total() + rem, D);
            this._set(tmp);
          }
        }
      } else {
        for (const [denomName, count] of Object.entries(arg)) {
          this._coins[denomName] = (this._coins[denomName] || 0) + count;
        }
      }
    }
    return this;
  }

  subtract(arg) {
    const D = this._getScaledDenominations();
    const delta = typeof arg === "number" ? this._getScaledValue(arg) : valueFromCoins(arg, D);
    if (!isNonNegInt(delta)) throw new Error(`Invalid value to subtract: ${delta}`);
    const tot = this.total();
    if (tot < delta) throw new Error(`Insufficient funds: short by ${delta - tot} (base units).`);

    if (this._opts.optimizeOnSubtract) {
      this._set(makeChange(tot - delta, D));
      return this;
    }

    const work = { ...this._coins };
    let remaining = delta;

    if (this._opts.spendSmallestFirst) {
      while (remaining > 0) {
        let spentThisPass = 0;

        // menor → maior
        for (let i = D.length - 1; i >= 0 && remaining > 0; i--) {
          const name = D[i].name, v = D[i].value;
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
          for (let i = D.length - 2; i >= 0; i--) {
            if (this._breakOne(work, i)) { broke = true; break; }
          }
          if (!broke) throw new Error("Insufficient funds (unexpected).");
        }
      }
    } else {
      // maior → menor (sem normalizar tudo)
      for (let i = 0; i < D.length && remaining > 0; i++) {
        const name = D[i].name, v = D[i].value;
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
    }

    const result = this._opts.repackAfterSubtract === "up" ? this._coalesceUp(work) : work;
    this._set(result);
    return this;
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
 * Integrates wallets with Foundry actors and settings.
 * @class CurrencyManager
 */
class CurrencyManager {
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
    const useModuleCurrency = game.settings.get(this.moduleId, "useModuleCurrencySystem");
    const currencyName = game.settings.get(this.moduleId, "currencyName") || "coins";

    let finalAmount = Number(amount) || 0;

    if (useModuleCurrency) {
      if (finalAmount > 0 && finalAmount < 0.01) finalAmount = 0.01;
      finalAmount = Math.round(finalAmount * 100) / 100;
      return finalAmount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else {
      if (finalAmount > 0 && finalAmount < 0.1) finalAmount = 0.1;
      else if (finalAmount > 0) finalAmount = Math.round(finalAmount * 10) / 10;
      return finalAmount.toString();
    }
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

  _flattenItemsFromObject(obj) {
    const items = [];
    if (typeof obj !== "object" || obj === null) return items;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === "object" && value !== null) {
          if (value.name !== undefined) {
            items.push({ id: key, data: value });
          } else {
            items.push(...this._flattenItemsFromObject(value));
          }
        }
      }
    }
    return items;
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
    const carriedItems = this._flattenItemsFromObject(carried);

    for (const denom of denominations) {
      const matchingItems = carriedItems.filter((entry) => {
        const itemName = String(entry.data.name || "").trim();
        const denomName = String(denom.name || "").trim();
        return itemName === denomName;
      });

      if (matchingItems.length > 0) {
        const entry = matchingItems[0];
        const count = entry.data.count || 0;
        const value = denom.value || 0;

        if (value > 0) {
          coinBreakdown.push({
            name: denom.name,
            count: count,
            value: value,
            itemId: entry.id
          });
        }
      }
    }
    return coinBreakdown;
  }

  async _setCharacterSheetCurrency(userId, newAmount) {
    const scaledNewAmount = (Number(newAmount) || 0) * this._baseUnitMultiplier;

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
    if (currentCoinBreakdown.length === 0) return false;

    const denominations = (game.settings.get(this.moduleId, "currencyDenominations") || [])
      .slice()
      .sort((a, b) => b.value - a.value);
    if (denominations.length === 0) return false;

    const unscaledCurrentTotal = currentCoinBreakdown.reduce(
      (sum, coin) => sum + coin.count * coin.value,
      0
    );
    const scaledCurrentTotal = unscaledCurrentTotal * this._baseUnitMultiplier;

    const finalScaledAmount = Math.max(0, scaledNewAmount);
    if (finalScaledAmount > scaledCurrentTotal) {
      // apenas reduz via ficha
      return false;
    }

    try {
      const currentCoinBag = {};
      for (const coinData of currentCoinBreakdown) currentCoinBag[coinData.name] = coinData.count;

      const optimizeOnConstruct = game.settings.get(this.moduleId, "optimizeOnConstruct");

      const wallet = new Wallet(
        currentCoinBag,
        {
          optimizeOnConstruct: optimizeOnConstruct,
          optimizeOnAdd: false,
          optimizeOnSubtract: false,
          spendSmallestFirst: true,
          repackAfterSubtract: "up"
        },
        denominations
      );

      const amountToSubtractScaled = scaledCurrentTotal - finalScaledAmount;
      const amountToSubtract = amountToSubtractScaled / this._baseUnitMultiplier;

      if (amountToSubtract > 0) wallet.subtract(amountToSubtract);

      const newCoinBag = wallet.toObject();
      const updateData = {};

      for (const denomination of denominations) {
        const newCount = newCoinBag[denomination.name] || 0;
        const currentCoinData = currentCoinBreakdown.find((coin) => coin.name === denomination.name);

        if (currentCoinData && currentCoinData.itemId) {
          if (newCount !== currentCoinData.count) {
            const currentItem = actor.system.equipment.carried[currentCoinData.itemId];
            updateData[`system.equipment.carried.${currentCoinData.itemId}.count`] = newCount;
            updateData[`system.equipment.carried.${currentCoinData.itemId}.costsum`] = parseFloat(
              (newCount * (currentItem.cost || 0)).toFixed(1)
            );
            updateData[`system.equipment.carried.${currentCoinData.itemId}.weightsum`] = parseFloat(
              (newCount * (currentItem.weight || 0)).toFixed(3)
            );
          }
        } else if (newCount > 0) {
          return false;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await actor.update(updateData);
      }

      if (actor.sheet && actor.sheet.rendered) actor.sheet.render(false);
      this._refreshWalletApplications();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refreshes any open wallet-related applications
   * @returns {void}
   */
  _refreshWalletApplications() {
    const { PlayerWalletApplication, VendorDisplayApplication, MoneyManagementApplication } = window;
    Object.values(ui.windows).forEach((app) => {
      if (
        (PlayerWalletApplication && app instanceof PlayerWalletApplication) ||
        (VendorDisplayApplication && app instanceof VendorDisplayApplication) ||
        (MoneyManagementApplication && app instanceof MoneyManagementApplication)
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
}

if (typeof window !== "undefined") {
  window.Wallet = Wallet;
  window.valueFromCoins = valueFromCoins;
  window.makeChange = makeChange;
  window.normalizeCoins = normalizeCoins;
  window.isNonNegInt = isNonNegInt;
  window.CurrencyManager = CurrencyManager;
}
